import logging
from typing import Any

from psycopg.types.json import Json

from app.database.postgres import get_connection
from app.database.repositories import RepositoryError
from app.image_ocr.models import EmbeddedImageOcrSummary, ImageOcrResult

logger = logging.getLogger(__name__)


class ImageTextRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def load_context(self, *, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id, organization_id, storage_bucket, storage_key
                    FROM documents
                    WHERE organization_id = %s AND id = %s AND deleted_at IS NULL
                """, (organization_id, document_id))
                document = cursor.fetchone()
                if not document:
                    raise RepositoryError(
                        "DOCUMENT_NOT_FOUND", "Document not found for organization", retryable=False,
                    )
                cursor.execute("""
                    SELECT i.id, i.page_number, i.image_index, i.image_metadata,
                           i.x0, i.y0, i.x1, i.y1, i.page_width, i.page_height,
                           i.is_decorative,
                           COUNT(*) OVER (
                               PARTITION BY i.document_id, i.image_metadata->>'xref'
                           ) AS xref_occurrences,
                           EXISTS (
                               SELECT 1 FROM document_page_texts pt
                               WHERE pt.organization_id = i.organization_id
                                 AND pt.document_id = i.document_id
                                 AND pt.page_number = i.page_number
                                 AND pt.source = 'OCR'
                           ) AS page_has_ocr,
                           it.ocr_status AS existing_status,
                           it.ocr_config AS existing_config,
                           it.text_length AS existing_text_length,
                           it.confidence_score AS existing_confidence_score,
                           it.duplicate_native_text AS existing_duplicate_native_text,
                           it.raw_text AS existing_raw_text,
                           it.ocr_metadata AS existing_ocr_metadata,
                           it.source_image_fingerprint AS existing_source_image_fingerprint,
                           it.ocr_configuration_fingerprint AS existing_ocr_configuration_fingerprint
                    FROM document_images i
                    LEFT JOIN document_image_texts it
                      ON it.organization_id = i.organization_id
                     AND it.document_id = i.document_id
                     AND it.image_id = i.id
                    WHERE i.organization_id = %s AND i.document_id = %s
                    ORDER BY i.page_number, i.image_index
                """, (organization_id, document_id))
                images = [dict(row) for row in cursor.fetchall()]
                cursor.execute("""
                    SELECT page_number, layout_blocks
                    FROM document_page_texts
                    WHERE organization_id = %s AND document_id = %s
                      AND COALESCE(source, 'PDF') <> 'OCR'
                    ORDER BY page_number
                """, (organization_id, document_id))
                native_texts = [dict(row) for row in cursor.fetchall()]
                return {"document": dict(document), "images": images, "native_texts": native_texts}

    def persist_results(
        self,
        *,
        organization_id: str,
        document_id: str,
        results: list[ImageOcrResult],
        summary: EmbeddedImageOcrSummary,
    ) -> int:
        persisted_ids: list[str] = []
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                for result in results:
                    cursor.execute("""
                        INSERT INTO document_image_texts (
                            organization_id, document_id, image_id, page_number,
                            raw_text, text_length, confidence_score, ocr_engine,
                            ocr_language, ocr_status, ocr_config, ocr_metadata,
                            duplicate_native_text, skip_reason, error_code, error_message,
                            source_image_fingerprint, ocr_configuration_fingerprint
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s
                        )
                        ON CONFLICT (organization_id, document_id, image_id)
                        DO UPDATE SET
                            page_number = EXCLUDED.page_number,
                            raw_text = EXCLUDED.raw_text,
                            text_length = EXCLUDED.text_length,
                            confidence_score = EXCLUDED.confidence_score,
                            ocr_engine = EXCLUDED.ocr_engine,
                            ocr_language = EXCLUDED.ocr_language,
                            ocr_status = EXCLUDED.ocr_status,
                            ocr_config = EXCLUDED.ocr_config,
                            ocr_metadata = EXCLUDED.ocr_metadata,
                            duplicate_native_text = EXCLUDED.duplicate_native_text,
                            skip_reason = EXCLUDED.skip_reason,
                            error_code = EXCLUDED.error_code,
                            error_message = EXCLUDED.error_message,
                            source_image_fingerprint = EXCLUDED.source_image_fingerprint,
                            ocr_configuration_fingerprint = EXCLUDED.ocr_configuration_fingerprint,
                            updated_at = NOW()
                        RETURNING id
                    """, (
                        organization_id, document_id, result.image_id, result.page_number,
                        result.raw_text or None, result.text_length, result.confidence_score,
                        result.ocr_engine, result.ocr_language, result.ocr_status,
                        Json(result.ocr_config), Json(result.ocr_metadata),
                        result.duplicate_native_text, result.skip_reason,
                        result.error_code, result.error_message,
                        result.source_image_fingerprint, result.ocr_configuration_fingerprint,
                    ))
                    persisted_row = cursor.fetchone()
                    persisted_id = str(persisted_row["id"])
                    persisted_ids.append(persisted_id)
                    logger.info(
                        "EMBEDDED_IMAGE_OCR_UPSERTED organization_id=%s document_id=%s "
                        "image_id=%s image_text_id=%s",
                        organization_id, document_id, result.image_id, persisted_id,
                    )
                    cursor.execute("""
                        UPDATE document_images
                        SET image_metadata = COALESCE(image_metadata, '{}'::jsonb)
                            || jsonb_build_object(
                                'source_image_fingerprint', %s::text,
                                'source_pixel_width', %s::integer,
                                'source_pixel_height', %s::integer,
                                'acquisition_strategy', %s::text
                            ),
                            updated_at = NOW()
                        WHERE organization_id = %s
                          AND document_id = %s
                          AND id = %s
                          AND page_number = %s
                    """, (
                        result.source_image_fingerprint,
                        result.ocr_metadata.get("source_pixel_width"),
                        result.ocr_metadata.get("source_pixel_height"),
                        result.ocr_config.get("acquisition_strategy"),
                        organization_id, document_id, result.image_id, result.page_number,
                    ))
                cursor.execute("""
                    UPDATE processing_jobs
                    SET result_metadata = COALESCE(result_metadata, '{}'::jsonb)
                        || jsonb_build_object('embedded_image_ocr', %s::jsonb),
                        updated_at = NOW()
                    WHERE id = (
                        SELECT id FROM processing_jobs
                        WHERE organization_id = %s AND document_id = %s
                        ORDER BY created_at DESC LIMIT 1
                    )
                """, (Json(summary.model_dump()), organization_id, document_id))
        # get_connection commits before control returns from the context manager.
        logger.info(
            "EMBEDDED_IMAGE_OCR_TRANSACTION_COMMITTED organization_id=%s document_id=%s "
            "rows_affected=%s image_text_ids=%s",
            organization_id, document_id, len(persisted_ids), persisted_ids,
        )
        return len(persisted_ids)

    @staticmethod
    def _validate_document(cursor: Any, organization_id: str, document_id: str) -> None:
        cursor.execute("""
            SELECT id FROM documents
            WHERE organization_id = %s AND id = %s AND deleted_at IS NULL
        """, (organization_id, document_id))
        if not cursor.fetchone():
            raise RepositoryError(
                "DOCUMENT_NOT_FOUND", "Document not found for organization", retryable=False,
            )
