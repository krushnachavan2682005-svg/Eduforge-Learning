from typing import Any

from psycopg.rows import dict_row

from app.database.postgres import get_connection


class DiagnosticsRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def load(self, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            connection.row_factory = dict_row
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM documents WHERE id=%s AND organization_id=%s AND deleted_at IS NULL", (document_id, organization_id))
                document = cursor.fetchone()
                if not document:
                    raise LookupError("Document not found for organization")
                cursor.execute("SELECT * FROM processing_jobs WHERE document_id=%s AND organization_id=%s ORDER BY created_at DESC LIMIT 1", (document_id, organization_id))
                job = cursor.fetchone()
                counts = {}
                for key, table in (("page_count","document_pages"),("page_text_count","document_page_texts"),("table_count","document_tables"),("image_count","document_images"),("image_text_count","document_image_texts"),("content_block_count","document_content_blocks"),("chunk_count","document_chunks")):
                    cursor.execute(f"SELECT count(*) AS count FROM {table} WHERE document_id=%s AND organization_id=%s", (document_id, organization_id))
                    counts[key] = cursor.fetchone()["count"]
                cursor.execute("""
                    SELECT p.page_number,p.route,p.text_length,
                      count(DISTINCT t.id) AS tables_detected,count(DISTINCT i.id) AS images_detected,
                      count(DISTINCT it.id) FILTER (WHERE it.ocr_status IN ('COMPLETED','REVIEW_REQUIRED')) AS image_ocr_completed,
                      count(DISTINCT b.id) AS content_blocks_created,
                      COALESCE(array_agg(DISTINCT b.block_type) FILTER (WHERE b.block_type IS NOT NULL),'{}') AS content_block_types,
                      COALESCE(array_agg(DISTINCT it.ocr_status) FILTER (WHERE it.ocr_status IS NOT NULL),'{}') AS image_ocr_statuses
                    FROM document_pages p
                    LEFT JOIN document_tables t ON t.document_id=p.document_id AND t.page_number=p.page_number
                    LEFT JOIN document_images i ON i.document_id=p.document_id AND i.page_number=p.page_number
                    LEFT JOIN document_image_texts it ON it.document_id=p.document_id AND it.page_number=p.page_number
                    LEFT JOIN document_content_blocks b ON b.document_id=p.document_id AND b.page_number=p.page_number
                    WHERE p.document_id=%s AND p.organization_id=%s
                    GROUP BY p.page_number,p.route,p.text_length ORDER BY p.page_number
                """, (document_id, organization_id))
                pages = cursor.fetchall()
        return {"document": dict(document), "job": dict(job) if job else None, "counts": counts, "pages": [dict(x) for x in pages]}
