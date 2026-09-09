import logging
from typing import Any

from app.database.postgres import get_connection
from app.schemas.chunking import ChunkingSummary, DocumentChunk
from app.schemas.ocr import OCRSummary
from app.schemas.persistence import ExtractionPersistenceRows, ExtractionPersistenceSummary
from psycopg.types.json import Json

logger = logging.getLogger(__name__)


class OCRSchemaNotReadyError(Exception):
    pass


class DocumentProcessingRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def prepare_job(self, *, job_id: str, document_id: str, organization_id: str) -> None:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self.verify_attempt(cursor, organization_id, document_id, job_id)

    def verify_attempt(self, cursor: Any, organization_id: str, document_id: str, job_id: str) -> None:
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
        if not row:
            raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found", retryable=False)
        if str(row["current_processing_job_id"]) != job_id or row["processing_status"] != "PROCESSING":
            raise RepositoryError("STALE_ATTEMPT", "Processing attempt is stale or invalid", retryable=False)

    def mark_success(
        self,
        *,
        job_id: str,
        document_id: str,
        organization_id: str,
        page_count: int,
        text_length: int,
    ) -> None:
        pass

    def mark_content_analysis_success(
        self,
        *,
        job_id: str,
        document_id: str,
        organization_id: str,
        page_count: int,
        text_extracted: bool,
        document_type: str,
        processing_stage: str,
        result_metadata: dict[str, Any],
    ) -> None:
        pass

    def persist_extraction_result(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        rows: ExtractionPersistenceRows,
    ) -> ExtractionPersistenceSummary:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self.verify_attempt(cursor, organization_id, document_id, job_id)
                self.delete_existing_extraction(
                    organization_id=organization_id,
                    document_id=document_id,
                    cursor=cursor,
                )
                self.insert_document_pages(rows.pages, cursor)
                self.insert_document_page_texts(rows.page_texts, cursor)
                self.insert_document_tables(rows.tables, cursor)
                self.insert_document_images(rows.images, cursor)

        return ExtractionPersistenceSummary(
            document_pages_saved=len(rows.pages),
            page_texts_saved=len(rows.page_texts),
            tables_saved=len(rows.tables),
            images_saved=len(rows.images),
        )

    def get_existing_extraction_summary(self, *, organization_id: str, document_id: str) -> dict[str, int]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                      (SELECT count(*) FROM document_pages WHERE organization_id=%s AND document_id=%s) AS pages,
                      (SELECT count(*) FROM document_page_texts WHERE organization_id=%s AND document_id=%s) AS texts,
                      (SELECT COALESCE(sum(text_length),0) FROM document_page_texts WHERE organization_id=%s AND document_id=%s) AS text_length,
                      (SELECT count(*) FROM document_tables WHERE organization_id=%s AND document_id=%s) AS tables,
                      (SELECT count(*) FROM document_images WHERE organization_id=%s AND document_id=%s) AS images
                    """,
                    (organization_id, document_id) * 5,
                )
                return dict(cursor.fetchone())

    def delete_existing_extraction(self, *, organization_id: str, document_id: str, cursor: Any) -> None:
        # Derived blocks reference source rows with RESTRICT foreign keys, so they
        # must be cleared before a full source re-extraction.
        for table_name in (
            "document_content_blocks",
            "document_image_texts",
            "document_images",
            "document_tables",
            "document_page_texts",
            "document_pages",
        ):
            cursor.execute(
                f"""
                DELETE FROM {table_name}
                WHERE organization_id = %s AND document_id = %s
                """,
                (organization_id, document_id),
            )

    def insert_document_pages(self, pages: list[Any], cursor: Any) -> None:
        for page in pages:
            cursor.execute(
                """
                INSERT INTO document_pages (
                    organization_id,
                    document_id,
                    page_number,
                    route,
                    has_text,
                    has_tables,
                    has_images,
                    needs_ocr,
                    text_length,
                    table_count,
                    image_count,
                    page_width,
                    page_height
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    page.organization_id,
                    page.document_id,
                    page.page_number,
                    page.route,
                    page.has_text,
                    page.has_tables,
                    page.has_images,
                    page.needs_ocr,
                    page.text_length,
                    page.table_count,
                    page.image_count,
                    page.page_width,
                    page.page_height,
                ),
            )

    def insert_document_page_texts(self, page_texts: list[Any], cursor: Any) -> None:
        for page_text in page_texts:
            cursor.execute(
                """
                INSERT INTO document_page_texts (
                    organization_id,
                    document_id,
                    page_number,
                    text,
                    text_length,
                    extraction_method,
                    layout_blocks,
                    page_width,
                    page_height
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    page_text.organization_id,
                    page_text.document_id,
                    page_text.page_number,
                    page_text.text,
                    page_text.text_length,
                    page_text.extraction_method,
                    Json(page_text.layout_blocks),
                    page_text.page_width,
                    page_text.page_height,
                ),
            )

    def insert_document_tables(self, tables: list[Any], cursor: Any) -> None:
        for table in tables:
            cursor.execute(
                """
                INSERT INTO document_tables (
                    organization_id,
                    document_id,
                    page_number,
                    table_index,
                    table_data,
                    row_count,
                    column_count,
                    extraction_method,
                    extraction_error,
                    x0, y0, x1, y1,
                    page_width, page_height
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    table.organization_id,
                    table.document_id,
                    table.page_number,
                    table.table_index,
                    Json(table.table_data),
                    table.row_count,
                    table.column_count,
                    table.extraction_method,
                    table.extraction_error,
                    *(table.bbox or (None, None, None, None)),
                    table.page_width,
                    table.page_height,
                ),
            )

    def insert_document_images(self, images: list[Any], cursor: Any) -> None:
        for image in images:
            cursor.execute(
                """
                INSERT INTO document_images (
                    organization_id,
                    document_id,
                    page_number,
                    image_index,
                    image_metadata,
                    extraction_method,
                    extraction_error,
                    x0, y0, x1, y1,
                    page_width, page_height, is_decorative
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    image.organization_id,
                    image.document_id,
                    image.page_number,
                    image.image_index,
                    Json(image.image_metadata),
                    image.extraction_method,
                    image.extraction_error,
                    *(image.bbox or (None, None, None, None)),
                    image.page_width,
                    image.page_height,
                    image.is_decorative,
                ),
            )

    def get_page_texts_for_document(self, *, organization_id: str, document_id: str) -> list[dict[str, Any]]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT page_number, text, text_length
                    FROM document_page_texts
                    WHERE organization_id = %s AND document_id = %s
                    ORDER BY page_number ASC
                    """,
                    (organization_id, document_id),
                )
                return list(cursor.fetchall())

    def get_page_metadata_for_document(self, *, organization_id: str, document_id: str) -> list[dict[str, Any]]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT page_number, has_tables, has_images, table_count, image_count, needs_ocr
                    FROM document_pages
                    WHERE organization_id = %s AND document_id = %s
                    ORDER BY page_number ASC
                    """,
                    (organization_id, document_id),
                )
                return list(cursor.fetchall())

    def persist_document_chunks(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
    ) -> ChunkingSummary:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self.verify_attempt(cursor, organization_id, document_id, job_id)
                self.delete_existing_chunks(
                    organization_id=organization_id,
                    document_id=document_id,
                    cursor=cursor,
                )
                self.insert_document_chunks(
                    organization_id=organization_id,
                    document_id=document_id,
                    chunks=chunks,
                    cursor=cursor,
                )

        return ChunkingSummary(
            chunks_saved=len(chunks),
            total_token_count=sum(chunk.token_count for chunk in chunks),
            total_char_count=sum(chunk.char_count for chunk in chunks),
        )

    def delete_existing_chunks(self, *, organization_id: str, document_id: str, cursor: Any) -> None:
        cursor.execute(
            """
            DELETE FROM document_chunks
            WHERE organization_id = %s AND document_id = %s
            """,
            (organization_id, document_id),
        )

    def insert_document_chunks(
        self,
        *,
        organization_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
        cursor: Any,
    ) -> None:
        for chunk in chunks:
            cursor.execute(
                """
                INSERT INTO document_chunks (
                    organization_id,
                    document_id,
                    chunk_index,
                    content,
                    chunk_text,
                    cleaned_text,
                    page_start,
                    page_end,
                    section_title,
                    token_count,
                    char_count,
                    chunk_type,
                    metadata,
                    embedding_status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    organization_id,
                    document_id,
                    chunk.chunk_index,
                    chunk.chunk_text,
                    chunk.chunk_text,
                    chunk.cleaned_text,
                    chunk.page_start,
                    chunk.page_end,
                    chunk.section_title,
                    chunk.token_count,
                    chunk.char_count,
                    chunk.chunk_type,
                    Json(chunk.metadata),
                    chunk.embedding_status,
                ),
            )

    def get_ocr_required_pages(self, organization_id: str, document_id: str) -> list[int]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT page_number
                    FROM document_pages
                    WHERE organization_id = %s
                      AND document_id = %s
                      AND needs_ocr = true
                    ORDER BY page_number ASC
                    """,
                    (organization_id, document_id),
                )
                return [row["page_number"] for row in cursor.fetchall()]

    def debug_document_ocr_state(self, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT COUNT(*) AS total_pages,
                           COUNT(*) FILTER (WHERE needs_ocr = true) AS needs_ocr_count
                    FROM document_pages
                    WHERE organization_id = %s AND document_id = %s
                    """,
                    (organization_id, document_id),
                )
                counts = cursor.fetchone()
                cursor.execute(
                    """
                    SELECT page_number, route, has_text, has_images, needs_ocr, text_length, ocr_status
                    FROM document_pages
                    WHERE organization_id = %s AND document_id = %s
                    ORDER BY page_number ASC
                    LIMIT 10
                    """,
                    (organization_id, document_id),
                )
                sample_rows = list(cursor.fetchall())
                page_numbers = [row["page_number"] for row in sample_rows if row["needs_ocr"]]
                return {
                    "total_document_pages": counts["total_pages"],
                    "needs_ocr_count": counts["needs_ocr_count"],
                    "page_numbers": page_numbers,
                    "sample_rows": sample_rows,
                }

    def debug_ocr_required_pages(self, organization_id: str, document_id: str) -> dict[str, Any]:
        return self.debug_document_ocr_state(organization_id, document_id)

    def get_document_storage_location(self, *, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, organization_id
                    FROM ai_documents
                    WHERE organization_id = %s AND id = %s
                    """,
                    (organization_id, document_id),
                )
                row = cursor.fetchone()
                if not row:
                    raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found", retryable=False)
                return dict(row)

    def assert_ocr_schema_ready(self) -> None:
        required_columns = {
            "document_page_texts": {"confidence_score", "source", "ocr_engine"},
            "document_pages": {"ocr_status", "ocr_confidence"},
        }
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                for table_name, expected_columns in required_columns.items():
                    cursor.execute(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = %s
                        """,
                        (table_name,),
                    )
                    existing = {row["column_name"] for row in cursor.fetchall()}
                    missing = sorted(expected_columns - existing)
                    if missing:
                        raise OCRSchemaNotReadyError(
                            f"OCR schema is missing columns on {table_name}: {', '.join(missing)}. "
                            "Run migration 011_add_ocr_metadata_columns.sql."
                        )

    def persist_ocr_results(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        ocr_summary: OCRSummary,
        min_text_length: int,
    ) -> int:
        self.assert_ocr_schema_ready()
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self.verify_attempt(cursor, organization_id, document_id, job_id)
                text_rows_upserted = 0
                pages_updated = 0
                for result in ocr_summary.results:
                    useful_text = result.text_length > 0 and result.status == "COMPLETED"
                    if result.text_length > 0:
                        self.upsert_ocr_page_text(
                            organization_id=organization_id,
                            document_id=document_id,
                            page_number=result.page_number,
                            text=result.text,
                            text_length=result.text_length,
                            confidence_score=result.confidence_score,
                            engine=ocr_summary.ocr_engine,
                            cursor=cursor,
                        )
                        text_rows_upserted += 1
                    self.update_page_after_ocr(
                        organization_id=organization_id,
                        document_id=document_id,
                        page_number=result.page_number,
                        text_length=result.text_length,
                        confidence_score=result.confidence_score,
                        ocr_status=result.status,
                        needs_ocr=not useful_text,
                        cursor=cursor,
                    )
                    pages_updated += 1
                logger.info(
                    "OCR persistence complete document_id=%s pages_updated=%s text_rows_upserted=%s",
                    document_id,
                    pages_updated,
                    text_rows_upserted,
                )
                return text_rows_upserted

    def upsert_ocr_page_text(
        self,
        *,
        organization_id: str,
        document_id: str,
        page_number: int,
        text: str,
        text_length: int,
        confidence_score: float | None,
        engine: str,
        cursor: Any,
    ) -> None:
        cursor.execute(
            """
            INSERT INTO document_page_texts (
                organization_id,
                document_id,
                page_number,
                text,
                text_length,
                extraction_method,
                confidence_score,
                source,
                ocr_engine,
                updated_at
            )
            VALUES (%s, %s, %s, %s, %s, 'tesseract_ocr', %s, 'OCR', %s, NOW())
            ON CONFLICT (document_id, page_number)
            DO UPDATE SET
                text = EXCLUDED.text,
                text_length = EXCLUDED.text_length,
                extraction_method = EXCLUDED.extraction_method,
                confidence_score = EXCLUDED.confidence_score,
                source = EXCLUDED.source,
                ocr_engine = EXCLUDED.ocr_engine,
                layout_blocks = '[]'::jsonb,
                updated_at = NOW()
            """,
            (organization_id, document_id, page_number, text, text_length, confidence_score, engine),
        )

    def update_page_after_ocr(
        self,
        *,
        organization_id: str,
        document_id: str,
        page_number: int,
        text_length: int,
        confidence_score: float | None,
        ocr_status: str,
        needs_ocr: bool,
        cursor: Any,
    ) -> None:
        cursor.execute(
            """
            UPDATE document_pages
            SET has_text = %s,
                text_length = %s,
                needs_ocr = %s,
                ocr_status = %s,
                ocr_confidence = %s,
                updated_at = NOW()
            WHERE organization_id = %s AND document_id = %s AND page_number = %s
            """,
            (
                text_length > 0,
                text_length,
                needs_ocr,
                ocr_status,
                confidence_score,
                organization_id,
                document_id,
                page_number,
            ),
        )

    def mark_failed(
        self,
        *,
        job_id: str,
        document_id: str,
        organization_id: str,
        error_code: str,
        error_message: str,
        processing_stage: str = "FAILED",
    ) -> None:
        pass


class RepositoryError(Exception):
    def __init__(self, error_code: str, message: str, retryable: bool) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.retryable = retryable

    def to_details(self) -> dict[str, Any]:
        return {
            "error_code": self.error_code,
            "message": self.message,
            "retryable": self.retryable,
        }
