# Embedded Image OCR Verification

## Migration

From `nodeJs Setup`, with `DATABASE_URL` exported:

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations/013_add_embedded_image_ocr.sql
```

Rollback requires stopping image-OCR/layout writers, dropping the
`document_content_blocks.image_text_id` foreign key and column, restoring the
previous block constraints from migration 012, and then dropping
`document_image_texts`. Raw page text, tables, images, and full-page OCR are not
changed by migration 013.

## Existing-document command

Run from `pythonscript/ai-service`:

```powershell
python -m app.image_ocr.run_embedded_image_ocr_for_document `
  --organization-id <organization_id> `
  --document-id <document_id>
```

## SQL verification

```sql
SELECT id, organization_id, document_id, image_id, page_number, ocr_status,
       confidence_score, text_length, ocr_engine, ocr_language,
       duplicate_native_text, ocr_config, LEFT(raw_text, 300) AS preview
FROM document_image_texts
WHERE organization_id = '<organization_id>'::uuid
  AND document_id = '<document_id>'::uuid
ORDER BY page_number, image_id;

SELECT i.id AS image_id, i.page_number, i.image_index, i.is_decorative,
       it.id AS image_text_id, it.ocr_status, it.confidence_score,
       it.text_length, it.duplicate_native_text, it.skip_reason
FROM document_images i
LEFT JOIN document_image_texts it
  ON it.organization_id = i.organization_id
 AND it.document_id = i.document_id
 AND it.image_id = i.id
WHERE i.organization_id = '<organization_id>'::uuid
  AND i.document_id = '<document_id>'::uuid
ORDER BY i.page_number, i.image_index;

SELECT page_number, block_order, block_type, source_type,
       image_id, image_text_id, LEFT(content_text, 200) AS preview
FROM document_content_blocks
WHERE organization_id = '<organization_id>'::uuid
  AND document_id = '<document_id>'::uuid
ORDER BY page_number, block_order;

-- Must return zero rows: IMAGE_TEXT not immediately after its parent IMAGE.
WITH ordered AS (
  SELECT b.*,
         LAG(block_type) OVER (
           PARTITION BY organization_id, document_id, page_number
           ORDER BY block_order
         ) AS previous_type,
         LAG((metadata->>'parent_image_id')::uuid) OVER (
           PARTITION BY organization_id, document_id, page_number
           ORDER BY block_order
         ) AS previous_parent_id,
         LAG(image_id) OVER (
           PARTITION BY organization_id, document_id, page_number
           ORDER BY block_order
         ) AS previous_image_id
  FROM document_content_blocks b
)
SELECT id, page_number, block_order
FROM ordered
WHERE block_type = 'IMAGE_TEXT'
  AND (previous_type <> 'IMAGE' OR previous_image_id <> (metadata->>'parent_image_id')::uuid);

-- Must return zero rows.
SELECT organization_id, document_id, image_id, COUNT(*)
FROM document_image_texts
GROUP BY organization_id, document_id, image_id
HAVING COUNT(*) > 1;

SELECT organization_id, document_id, page_number, block_order, COUNT(*)
FROM document_content_blocks
GROUP BY organization_id, document_id, page_number, block_order
HAVING COUNT(*) > 1;

-- Broken image ownership/source references: all must return zero rows.
SELECT it.id
FROM document_image_texts it
LEFT JOIN document_images i
  ON i.id = it.image_id
 AND i.organization_id = it.organization_id
 AND i.document_id = it.document_id
WHERE i.id IS NULL;

SELECT b.id
FROM document_content_blocks b
LEFT JOIN document_image_texts it
  ON it.id = b.image_text_id
 AND it.organization_id = b.organization_id
 AND it.document_id = b.document_id
WHERE b.image_text_id IS NOT NULL AND it.id IS NULL;

SELECT it.id
FROM document_image_texts it
JOIN document_images i ON i.id = it.image_id
WHERE i.organization_id <> it.organization_id OR i.document_id <> it.document_id;
```

## Manual live matrix

Use the CLI command above after normal extraction has persisted `document_images`.
Expected logs begin with `EMBEDDED_IMAGE_OCR_START`, show a selected or skipped
decision for every image, show acquisition/preprocessing/OCR-pass/result events for
selected images, then persistence, layout rebuild, and completion.

| Input | Expected result | Failure indicators |
|---|---|---|
| `digital_mixed_content_layout_test.pdf` | OCR contains multiple `INPUT`, `Digital page`, `LAYOUT`, `Mixed blocks`, `OUTPUT`, `Ordered content` tokens; `IMAGE, IMAGE_TEXT` precedes `TABLE` | Native `IMAGE_BLOCK_01` claimed as pixel OCR; no `IMAGE_TEXT`; wrong order |
| Digital screenshot | `COMPLETED` or `REVIEW_REQUIRED`; raw text and confidence persisted | Image bytes stored in PostgreSQL; missing source link |
| Digital chart | Labels may be extracted; chart meaning is not inferred | Semantic claims about chart relationships |
| Decorative-logo PDF | `SKIPPED/DECORATIVE_IMAGE`; no `IMAGE_TEXT` | Logo text pollutes ordered stream |
| Fully scanned PDF | full-page images `SKIPPED/SYNTHETIC_SCANNED_PAGE`; existing `OCR_TEXT` remains | Duplicate `IMAGE_TEXT` per scanned page |
| Low-quality image | raw text persisted as `REVIEW_REQUIRED` below configured confidence | Low-confidence text silently marked trusted |
| Repeated run | one row per image, stable IMAGE_TEXT count/order | row count grows or ordering changes |
| Wrong tenant | CLI exits non-zero; no data changes | successful exit or changed rows |

For every case, run the result/link/order/duplicate/broken-reference queries above.
`NO_TEXT_DETECTED` is a valid OCR outcome and must leave the parent `IMAGE` block
without creating `IMAGE_TEXT`.
