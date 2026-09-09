from typing import Any

from psycopg.types.json import Json

from app.chunking.models import ChunkingSummary, DocumentChunk
from app.database.postgres import get_connection
from app.database.repositories import RepositoryError


class CanonicalContentRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def load(self, *, organization_id: str, document_id: str) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT d.id, d.organization_id, d.processing_stage, d.status,
                           (SELECT j.id FROM processing_jobs j
                            WHERE j.organization_id=d.organization_id AND j.document_id=d.id
                            ORDER BY j.created_at DESC LIMIT 1) AS job_id
                    FROM documents d
                    WHERE d.organization_id=%s AND d.id=%s AND d.deleted_at IS NULL
                """, (organization_id, document_id))
                document = cursor.fetchone()
                if not document:
                    raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found for organization", False)
                cursor.execute("""
                    SELECT b.id, b.page_number, b.block_order, b.block_type, b.source_type,
                           b.page_text_id, b.table_id, b.image_id, b.image_text_id,
                           b.content_text, b.readable_text, b.x0, b.y0, b.x1, b.y1,
                           b.page_width, b.page_height, b.extraction_method, b.metadata,
                           COALESCE(it.confidence_score, pt.confidence_score) AS confidence_score,
                           it.ocr_status AS image_text_status,
                           it.image_id AS parent_image_id,
                           pt.ocr_engine AS page_ocr_engine,
                           pt.source AS page_text_source
                    FROM document_content_blocks b
                    LEFT JOIN document_image_texts it
                      ON it.id=b.image_text_id AND it.organization_id=b.organization_id
                     AND it.document_id=b.document_id
                    LEFT JOIN document_page_texts pt
                      ON pt.id=b.page_text_id AND pt.organization_id=b.organization_id
                     AND pt.document_id=b.document_id
                    WHERE b.organization_id=%s AND b.document_id=%s
                    ORDER BY b.page_number, b.block_order
                """, (organization_id, document_id))
                return {"document": dict(document), "blocks": [dict(row) for row in cursor.fetchall()]}


class ChunkRepository:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def replace(
        self,
        *,
        organization_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
        summary: ChunkingSummary,
    ) -> int:
        if not chunks:
            raise ValueError("Cannot mark EMBEDDING_READY without chunks")
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._lock_and_validate(cursor, organization_id, document_id)
                cursor.execute(
                    "UPDATE documents SET processing_stage='CHUNKING', updated_at=NOW() WHERE organization_id=%s AND id=%s",
                    (organization_id, document_id),
                )
                for chunk in chunks:
                    cursor.execute("""
                        INSERT INTO document_chunks (
                            organization_id, document_id, chunk_index, content, token_count,
                            page_start, page_end, source_pages, section_title, content_types,
                            source_block_ids, char_count, chunk_type, metadata, embedding_status,
                            tokenizer_name, chunking_strategy, content_fingerprint, updated_at
                        ) VALUES (
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW()
                        )
                        ON CONFLICT (organization_id, document_id, chunk_index)
                        DO UPDATE SET
                            content=EXCLUDED.content,
                            token_count=EXCLUDED.token_count,
                            page_start=EXCLUDED.page_start,
                            page_end=EXCLUDED.page_end,
                            source_pages=EXCLUDED.source_pages,
                            section_title=EXCLUDED.section_title,
                            content_types=EXCLUDED.content_types,
                            source_block_ids=EXCLUDED.source_block_ids,
                            char_count=EXCLUDED.char_count,
                            chunk_type=EXCLUDED.chunk_type,
                            metadata=EXCLUDED.metadata,
                            embedding_status=CASE
                              WHEN document_chunks.content_fingerprint=EXCLUDED.content_fingerprint
                              THEN document_chunks.embedding_status ELSE 'PENDING' END,
                            embedding_model=CASE
                              WHEN document_chunks.content_fingerprint=EXCLUDED.content_fingerprint
                              THEN document_chunks.embedding_model ELSE NULL END,
                            tokenizer_name=EXCLUDED.tokenizer_name,
                            chunking_strategy=EXCLUDED.chunking_strategy,
                            content_fingerprint=EXCLUDED.content_fingerprint,
                            updated_at=NOW()
                    """, (
                        organization_id, document_id, chunk.chunk_index, chunk.content, chunk.token_count,
                        chunk.page_start, chunk.page_end, chunk.source_pages, chunk.section_title,
                        chunk.content_types, chunk.source_block_ids, chunk.char_count,
                        _chunk_type(chunk.content_types), Json(chunk.metadata), chunk.embedding_status,
                        chunk.tokenizer_name, chunk.chunking_strategy, chunk.content_fingerprint,
                    ))
                cursor.execute(
                    "DELETE FROM document_chunks WHERE organization_id=%s AND document_id=%s AND NOT (chunk_index=ANY(%s))",
                    (organization_id, document_id, [chunk.chunk_index for chunk in chunks]),
                )
                cursor.execute("""
                    UPDATE processing_jobs
                    SET result_metadata=COALESCE(result_metadata,'{}'::jsonb)
                        || jsonb_build_object('chunking', %s::jsonb), updated_at=NOW()
                    WHERE id=(SELECT id FROM processing_jobs
                              WHERE organization_id=%s AND document_id=%s
                              ORDER BY created_at DESC LIMIT 1)
                """, (Json(summary.to_dict()), organization_id, document_id))
        return len(chunks)

    def mark_no_text(self, *, organization_id: str, document_id: str, summary: ChunkingSummary) -> None:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._lock_and_validate(cursor, organization_id, document_id)
                cursor.execute(
                    "DELETE FROM document_chunks WHERE organization_id=%s AND document_id=%s",
                    (organization_id, document_id),
                )
                cursor.execute(
                    "UPDATE documents SET processing_stage='NO_TEXT_AVAILABLE', updated_at=NOW() WHERE organization_id=%s AND id=%s",
                    (organization_id, document_id),
                )
                cursor.execute("""
                    UPDATE processing_jobs
                    SET result_metadata=COALESCE(result_metadata,'{}'::jsonb)
                        || jsonb_build_object('chunking', %s::jsonb), updated_at=NOW()
                    WHERE id=(SELECT id FROM processing_jobs
                              WHERE organization_id=%s AND document_id=%s
                              ORDER BY created_at DESC LIMIT 1)
                """, (Json(summary.to_dict()), organization_id, document_id))

    @staticmethod
    def _lock_and_validate(cursor: Any, organization_id: str, document_id: str) -> None:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"{organization_id}:{document_id}",))
        cursor.execute("""
            SELECT id FROM documents
            WHERE organization_id=%s AND id=%s AND deleted_at IS NULL FOR UPDATE
        """, (organization_id, document_id))
        if not cursor.fetchone():
            raise RepositoryError("DOCUMENT_NOT_FOUND", "Document not found for organization", False)


def _chunk_type(content_types: list[str]) -> str:
    unique = set(content_types)
    return next(iter(unique)) if len(unique) == 1 else "MIXED"
