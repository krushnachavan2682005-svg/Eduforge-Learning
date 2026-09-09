# Ordered Content Layout Verification

## Apply migrations

Run from `nodeJs Setup` with `DATABASE_URL` exported:

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations/011_add_ocr_metadata_columns.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f migrations/012_create_document_content_blocks.sql
```

Both migrations are idempotent. Migration 012 is additive. A rollback should first
stop layout writers, then drop `document_content_blocks`, its three source unique
indexes, and only then remove the added source-layout columns if no other consumer
uses them. Do not remove OCR columns merely to roll back the layout layer.

## Rebuild an existing document

Run from `pythonscript/ai-service`:

```powershell
python -m app.content_layout.run_content_layout_for_document `
  --organization-id <organization_id> `
  --document-id <document_id>
```

Expected logs progress from `CONTENT_LAYOUT_START` through
`CONTENT_LAYOUT_BLOCKS_PERSISTED` and `CONTENT_LAYOUT_DONE`. Any
`CONTENT_LAYOUT_FAILED`, missing source link, duplicate position, or unexpected
type sequence is a failure indicator.

## SQL verification

```sql
-- Canonical ordered stream.
SELECT page_number, block_order, block_type, source_type,
       COALESCE(page_text_id::text, table_id::text, image_id::text) AS source_record_id,
       x0, y0, x1, y1
FROM document_content_blocks
WHERE organization_id = '<organization_id>'::uuid
  AND document_id = '<document_id>'::uuid
ORDER BY page_number, block_order;

-- Must return zero rows.
SELECT organization_id, document_id, page_number, block_order, COUNT(*)
FROM document_content_blocks
GROUP BY organization_id, document_id, page_number, block_order
HAVING COUNT(*) > 1;

SELECT block_type, COUNT(*)
FROM document_content_blocks
WHERE organization_id = '<organization_id>'::uuid
  AND document_id = '<document_id>'::uuid
GROUP BY block_type
ORDER BY block_type;

SELECT page_number, ARRAY_AGG(block_type ORDER BY block_order) AS ordered_types
FROM document_content_blocks
WHERE organization_id = '<organization_id>'::uuid
  AND document_id = '<document_id>'::uuid
GROUP BY page_number
ORDER BY page_number;

-- All three source-link checks must return zero rows.
SELECT b.id FROM document_content_blocks b
LEFT JOIN document_page_texts t
  ON t.id = b.page_text_id AND t.organization_id = b.organization_id AND t.document_id = b.document_id
WHERE b.page_text_id IS NOT NULL AND t.id IS NULL;

SELECT b.id FROM document_content_blocks b
LEFT JOIN document_tables t
  ON t.id = b.table_id AND t.organization_id = b.organization_id AND t.document_id = b.document_id
WHERE b.table_id IS NOT NULL AND t.id IS NULL;

SELECT b.id FROM document_content_blocks b
LEFT JOIN document_images i
  ON i.id = b.image_id AND i.organization_id = b.organization_id AND i.document_id = b.document_id
WHERE b.image_id IS NOT NULL AND i.id IS NULL;
```

## Manual matrix

Use the rebuild command above after the normal processing endpoint has persisted
the source rows.

| Input | Expected ordered rows | Failure indicators |
|---|---|---|
| Normal digital PDF | One or more `TEXT` blocks per page in visual order | One concatenated block after a fresh full reprocess, missing coordinates |
| Text + tables | `TEXT`/`TABLE` interleaving; cell-text blocks inside table boxes suppressed | Table duplicated as both semantic text and `TABLE` |
| Text + image + table + text | `{TEXT,IMAGE,TABLE,TEXT}` for the fixture page | Grouped-by-type output |
| Scanned PDF | One page-level `OCR_TEXT`; scanned page raster excluded | `OCR_TEXT` plus a full-page `IMAGE` |
| Multi-column PDF | Full-width heading, complete left column, complete right column | Line-by-line left/right alternation |
| Same document twice | Same count and ordered types; no duplicate positions | Count increases or order changes |
| Wrong organization | CLI exits non-zero and existing rows remain unchanged | Any insert/delete or successful exit |

For each successful run, confirm the start/page/resolution/persist/done logs, inspect
the ordered stream query, run the duplicate query, and run all source-link checks.
Legacy documents processed before migration 012 require a normal full reprocess to
populate block coordinates; the CLI can only use source metadata already persisted.
