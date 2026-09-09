import logging
import time
import uuid
from typing import Any

from psycopg.types.json import Json

from app.content_layout.models import ResolvedContentBlock
from app.database.postgres import get_connection
from app.database.repositories import RepositoryError

logger = logging.getLogger(__name__)


class ContentBlockRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def load_sources(self, *, organization_id: str, document_id: str) -> dict[str, list[dict[str, Any]]]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                return {
                    "pages": self._fetch(cursor, """
                        SELECT page_number, page_width, page_height, needs_ocr
                        FROM document_pages
                        WHERE organization_id = %s AND document_id = %s
                        ORDER BY page_number
                    """, organization_id, document_id),
                    "texts": self._fetch(cursor, """
                        SELECT id, page_number, text, extraction_method, source,
                               layout_blocks, page_width, page_height
                        FROM document_page_texts
                        WHERE organization_id = %s AND document_id = %s
                        ORDER BY page_number
                    """, organization_id, document_id),
                    "tables": self._fetch(cursor, """
                        SELECT id, page_number, table_index, table_data, extraction_method,
                               x0, y0, x1, y1, page_width, page_height, row_count, column_count
                        FROM document_tables
                        WHERE organization_id = %s AND document_id = %s
                        ORDER BY page_number, table_index
                    """, organization_id, document_id),
                    "images": self._fetch(cursor, """
                        SELECT id, page_number, image_index, image_metadata, extraction_method,
                               x0, y0, x1, y1, page_width, page_height, is_decorative
                        FROM document_images
                        WHERE organization_id = %s AND document_id = %s
                        ORDER BY page_number, image_index
                    """, organization_id, document_id),
                    "image_texts": self._fetch(cursor, """
                        SELECT it.id, it.image_id, it.page_number, it.raw_text,
                               it.confidence_score, it.ocr_status, it.ocr_engine,
                               it.ocr_config, it.source_image_fingerprint,
                               it.ocr_configuration_fingerprint,
                               i.x0, i.y0, i.x1, i.y1,
                               i.page_width, i.page_height, i.image_index
                        FROM document_image_texts it
                        JOIN document_images i
                          ON i.id = it.image_id
                         AND i.organization_id = it.organization_id
                         AND i.document_id = it.document_id
                        WHERE it.organization_id = %s AND it.document_id = %s
                          AND it.ocr_status IN ('COMPLETED', 'REVIEW_REQUIRED')
                          AND it.duplicate_native_text = false
                          AND it.text_length > 0
                        ORDER BY it.page_number, i.image_index
                    """, organization_id, document_id),
                }

    def replace_blocks(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        blocks: list[ResolvedContentBlock],
        content_layout_metadata: dict[str, Any],
    ) -> int:
        started = time.monotonic()
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                cursor.execute(
                    """
                    SELECT current_processing_job_id, processing_status
                    FROM ai_documents
                    WHERE id = %s AND organization_id = %s
                    FOR UPDATE
                    """,
                    (document_id, organization_id),
                )
                row = cursor.fetchone()
                if not row or str(row["current_processing_job_id"]) != job_id or row["processing_status"] != "PROCESSING":
                    raise RepositoryError("STALE_ATTEMPT", "Processing attempt is stale or invalid", retryable=False)

                cursor.execute(
                    "DELETE FROM document_content_blocks WHERE organization_id = %s AND document_id = %s",
                    (organization_id, document_id),
                )
                for block in blocks:
                    block_id = uuid.uuid5(
                        uuid.NAMESPACE_URL,
                        f"document-content-block:{organization_id}:{document_id}:{block.page_number}:"
                        f"{block.block_order}:{block.block_type}:{block.source_type}:{block.source_id}",
                    )
                    source_ids = {
                        "page_text_id": block.source_id if block.source_type in {"DOCUMENT_PAGE_TEXT", "OCR_RESULT"} else None,
                        "table_id": block.source_id if block.source_type == "DOCUMENT_TABLE" else None,
                        "image_id": (
                            block.source_id if block.source_type == "DOCUMENT_IMAGE"
                            else block.metadata.get("parent_image_id")
                            if block.source_type == "DOCUMENT_IMAGE_TEXT" else None
                        ),
                        "image_text_id": block.source_id if block.source_type == "DOCUMENT_IMAGE_TEXT" else None,
                    }
                    bbox = block.bbox or (None, None, None, None)
                    cursor.execute("""
                        INSERT INTO document_content_blocks (
                            id, organization_id, document_id, page_number, block_order,
                            block_type, source_type, page_text_id, table_id, image_id, image_text_id,
                            content_text, readable_text, x0, y0, x1, y1,
                            page_width, page_height, extraction_method, metadata
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        block_id, organization_id, document_id, block.page_number, block.block_order,
                        block.block_type, block.source_type, source_ids["page_text_id"],
                        source_ids["table_id"], source_ids["image_id"],
                        source_ids["image_text_id"], block.content_text,
                        block.readable_text, *bbox, block.page_width, block.page_height,
                        block.extraction_method, Json(block.metadata),
                    ))
        for block in blocks:
            if block.block_type == "TABLE":
                logger.info(
                    "TABLE_CONTENT_BLOCK_CREATED organization_id=%s document_id=%s table_id=%s page_number=%s table_index=%s row_count=%s column_count=%s formatted_text_length=%s block_order=%s duration_ms=%s",
                    organization_id, document_id, block.source_id, block.page_number,
                    block.metadata.get("table_index"), block.metadata.get("row_count"),
                    block.metadata.get("column_count"), len(block.content_text or ""),
                    block.block_order, round((time.monotonic() - started) * 1000),
                )
        return len(blocks)

    def fetch_ordered(self, *, organization_id: str, document_id: str, page_number: int | None = None) -> list[dict[str, Any]]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                params: list[Any] = [organization_id, document_id]
                page_clause = ""
                if page_number is not None:
                    page_clause = " AND page_number = %s"
                    params.append(page_number)
                cursor.execute(f"""
                    SELECT page_number, block_order, block_type, source_type,
                           page_text_id, table_id, image_id, image_text_id, content_text, readable_text,
                           x0, y0, x1, y1, page_width, page_height,
                           extraction_method, metadata
                    FROM document_content_blocks
                    WHERE organization_id = %s AND document_id = %s {page_clause}
                    ORDER BY page_number, block_order
                """, params)
                return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def _fetch(cursor: Any, query: str, organization_id: str, document_id: str) -> list[dict[str, Any]]:
        cursor.execute(query, (organization_id, document_id))
        return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def _validate_document(cursor: Any, organization_id: str, document_id: str) -> None:
        cursor.execute("""
            SELECT id FROM ai_documents
            WHERE organization_id = %s AND id = %s
        """, (organization_id, document_id))
        if not cursor.fetchone():
            raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found for organization", retryable=False)
