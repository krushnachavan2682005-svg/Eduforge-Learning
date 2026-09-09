import uuid
from typing import Any

from psycopg.types.json import Json

from app.database.postgres import get_connection
from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import EmbeddingChunk, EmbeddingError, GeneratedEmbedding


class EmbeddingVectorStore:
    """Persistence contract intentionally excludes similarity-search operations."""


class PgVectorEmbeddingRepository(EmbeddingVectorStore):
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def environment_info(self) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database() database, version() postgresql_version")
                result = dict(cursor.fetchone())
                cursor.execute("SELECT default_version FROM pg_available_extensions WHERE name='vector'")
                available = cursor.fetchone()
                cursor.execute("SELECT extversion FROM pg_extension WHERE extname='vector'")
                enabled = cursor.fetchone()
                result.update(
                    vector_available=available is not None,
                    vector_available_version=available["default_version"] if available else None,
                    vector_enabled=enabled is not None,
                    vector_enabled_version=enabled["extversion"] if enabled else None,
                )
                return result

    def embedding_schema_info(self) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT to_regclass('public.document_chunk_embeddings') table_name")
                exists = cursor.fetchone()["table_name"] is not None
                if not exists:
                    return {"table_exists": False, "vector_type": None, "constraints": [], "indexes": []}
                cursor.execute("""
                    SELECT format_type(a.atttypid,a.atttypmod) vector_type
                    FROM pg_attribute a
                    WHERE a.attrelid='public.document_chunk_embeddings'::regclass
                      AND a.attname='embedding' AND NOT a.attisdropped
                """)
                vector_row = cursor.fetchone()
                cursor.execute("SELECT conname FROM pg_constraint WHERE conrelid='public.document_chunk_embeddings'::regclass")
                constraints = [row["conname"] for row in cursor.fetchall()]
                cursor.execute("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='document_chunk_embeddings'")
                indexes = [row["indexname"] for row in cursor.fetchall()]
                return {"table_exists": True, "vector_type": vector_row["vector_type"] if vector_row else None, "constraints": constraints, "indexes": indexes}

    def inspect_plan(self, *, organization_id: str, document_id: str, configuration: EmbeddingConfiguration) -> dict[str, Any]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                cursor.execute("SELECT count(*) total FROM document_chunks WHERE organization_id=%s AND document_id=%s", (organization_id, document_id))
                total = cursor.fetchone()["total"]
                cursor.execute("SELECT to_regclass('public.document_chunk_embeddings') table_name")
                table_exists = cursor.fetchone()["table_name"] is not None
                if not table_exists:
                    return {"total_chunks": total, "already_valid": 0, "pending": total, "stale": 0, "failed_retryable": 0}
                cursor.execute("""
                    SELECT
                      count(*) FILTER (WHERE e.id IS NOT NULL) already_valid,
                      count(*) FILTER (WHERE e.id IS NULL AND c.embedding_status='PENDING') pending,
                      count(*) FILTER (WHERE e.id IS NULL AND c.embedding_status='FAILED') failed_retryable,
                      count(*) FILTER (WHERE e.id IS NULL AND c.embedding_status='COMPLETED') stale
                    FROM document_chunks c
                    LEFT JOIN document_chunk_embeddings e
                      ON e.organization_id=c.organization_id AND e.document_id=c.document_id
                     AND e.chunk_id=c.id AND e.content_fingerprint=c.content_fingerprint
                     AND e.embedding_configuration_fingerprint=%s
                     AND e.embedding_dimension=%s
                     AND vector_dims(e.embedding)=%s AND vector_norm(e.embedding)>0
                     AND (%s=false OR abs(vector_norm(e.embedding)-1.0)<=0.001)
                    WHERE c.organization_id=%s AND c.document_id=%s
                """, (configuration.fingerprint, configuration.dimension, configuration.dimension,
                      configuration.normalize, organization_id, document_id))
                row = dict(cursor.fetchone())
                return {"total_chunks": total, **row}

    def claim_chunks(self, *, organization_id: str, document_id: str, configuration: EmbeddingConfiguration,
                     force: bool, retry_failed: bool, timeout_seconds: int,
                     job_id: str | None = None) -> list[EmbeddingChunk]:
        claim_token = str(uuid.uuid4())
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                if job_id:
                    cursor.execute("""
                        SELECT id,status,job_type FROM processing_jobs
                        WHERE id=%s AND organization_id=%s AND document_id=%s FOR UPDATE
                    """, (job_id, organization_id, document_id))
                    job = cursor.fetchone()
                    if not job or job["job_type"] != "EMBEDDING":
                        raise EmbeddingError("EMBEDDING_JOB_NOT_FOUND", "Embedding job not found for document")
                    if job["status"] == "RUNNING":
                        raise EmbeddingError("EMBEDDING_JOB_ALREADY_RUNNING", "Embedding job is already running", True)
                cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"embedding:{organization_id}:{document_id}:{configuration.fingerprint}",))
                cursor.execute("""
                    SELECT count(*) active
                    FROM document_chunks
                    WHERE organization_id=%s AND document_id=%s AND embedding_status='PROCESSING'
                      AND embedding_processing_started_at > NOW()-(%s * INTERVAL '1 second')
                """, (organization_id, document_id, timeout_seconds))
                if cursor.fetchone()["active"]:
                    raise EmbeddingError("EMBEDDING_JOB_ALREADY_RUNNING", "Another worker owns this document", True)
                cursor.execute("""
                    UPDATE document_chunks
                    SET embedding_status='PENDING', embedding_claim_token=NULL,
                        embedding_processing_started_at=NULL, updated_at=NOW()
                    WHERE organization_id=%s AND document_id=%s AND embedding_status='PROCESSING'
                      AND embedding_processing_started_at <= NOW()-(%s * INTERVAL '1 second')
                """, (organization_id, document_id, timeout_seconds))
                cursor.execute("""
                    SELECT c.id,c.chunk_index,c.content,c.content_fingerprint,c.source_pages,c.token_count,
                           c.embedding_retry_count
                    FROM document_chunks c
                    LEFT JOIN document_chunk_embeddings e
                      ON e.organization_id=c.organization_id AND e.document_id=c.document_id
                     AND e.chunk_id=c.id AND e.content_fingerprint=c.content_fingerprint
                     AND e.embedding_configuration_fingerprint=%s AND e.embedding_dimension=%s
                     AND vector_dims(e.embedding)=%s AND vector_norm(e.embedding)>0
                     AND (%s=false OR abs(vector_norm(e.embedding)-1.0)<=0.001)
                    WHERE c.organization_id=%s AND c.document_id=%s
                      AND c.embedding_status <> 'PROCESSING'
                      AND (%s OR e.id IS NULL)
                      AND (%s OR c.embedding_status <> 'FAILED')
                    ORDER BY c.chunk_index
                """, (configuration.fingerprint, configuration.dimension, configuration.dimension,
                      configuration.normalize, organization_id, document_id, force, retry_failed or force))
                rows = [dict(row) for row in cursor.fetchall()]
                if rows:
                    cursor.execute("""
                        UPDATE document_chunks
                        SET embedding_status='PROCESSING', embedding_claim_token=%s,
                            embedding_processing_started_at=NOW(), embedding_error_code=NULL,
                            embedding_error_message=NULL, updated_at=NOW()
                        WHERE organization_id=%s AND document_id=%s AND id=ANY(%s)
                    """, (claim_token, organization_id, document_id, [row["id"] for row in rows]))
                    cursor.execute("UPDATE documents SET processing_stage='EMBEDDING',updated_at=NOW() WHERE organization_id=%s AND id=%s", (organization_id, document_id))
                    if job_id:
                        cursor.execute("""
                            UPDATE processing_jobs SET status='RUNNING',attempt_count=attempt_count+1,
                              started_at=NOW(),failed_at=NULL,error_code=NULL,error_message=NULL,updated_at=NOW()
                            WHERE id=%s AND organization_id=%s AND document_id=%s
                        """, (job_id, organization_id, document_id))
                return [EmbeddingChunk(
                    id=row["id"], chunk_index=row["chunk_index"], content=row["content"],
                    content_fingerprint=row["content_fingerprint"].strip(), source_pages=list(row["source_pages"]),
                    token_count=row["token_count"], claim_token=claim_token,
                    retry_count=row["embedding_retry_count"],
                ) for row in rows]

    def persist_batch(self, *, organization_id: str, document_id: str,
                      configuration: EmbeddingConfiguration, embeddings: list[GeneratedEmbedding]) -> int:
        try:
            from pgvector.psycopg import Vector
            from pgvector.psycopg import register_vector
        except ImportError as exc:
            raise EmbeddingError("PGVECTOR_PYTHON_ADAPTER_NOT_INSTALLED", "Install the Python pgvector adapter") from exc
        with get_connection(self.database_url) as connection:
            register_vector(connection)
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                for item in embeddings:
                    chunk = item.chunk
                    cursor.execute("""
                        INSERT INTO document_chunk_embeddings (
                          organization_id,document_id,chunk_id,chunk_index,content_fingerprint,
                          source_pages,embedding_provider,embedding_model,embedding_model_revision,
                          embedding_dimension,embedding_configuration_fingerprint,embedding,normalized,
                          generation_duration_ms,embedding_attempt,source_token_count
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (organization_id,document_id,chunk_id,content_fingerprint,embedding_configuration_fingerprint)
                        DO UPDATE SET embedding=EXCLUDED.embedding,normalized=EXCLUDED.normalized,
                          generation_duration_ms=EXCLUDED.generation_duration_ms,
                          embedding_attempt=EXCLUDED.embedding_attempt,source_token_count=EXCLUDED.source_token_count,
                          updated_at=NOW()
                    """, (organization_id, document_id, chunk.id, chunk.chunk_index,
                          chunk.content_fingerprint, chunk.source_pages, configuration.provider,
                          configuration.model, configuration.model_revision, configuration.dimension,
                          configuration.fingerprint, Vector(item.vector), configuration.normalize,
                          item.generation_duration_ms, item.attempt, chunk.token_count))
                    cursor.execute("""
                        UPDATE document_chunks SET embedding_status='COMPLETED',embedding_model=%s,
                          embedding_retry_count=%s,embedding_claim_token=NULL,
                          embedding_processing_started_at=NULL,embedding_error_code=NULL,
                          embedding_error_message=NULL,updated_at=NOW()
                        WHERE organization_id=%s AND document_id=%s AND id=%s
                          AND chunk_index=%s AND content_fingerprint=%s AND embedding_claim_token=%s
                    """, (configuration.model, item.attempt - 1, organization_id, document_id,
                          chunk.id, chunk.chunk_index, chunk.content_fingerprint, chunk.claim_token))
                    if cursor.rowcount != 1:
                        raise EmbeddingError("EMBEDDING_CLAIM_LOST", "Chunk changed or claim ownership was lost", True)
        return len(embeddings)

    def mark_failed(self, *, organization_id: str, document_id: str, chunks: list[EmbeddingChunk],
                    error_code: str, message: str) -> None:
        if not chunks:
            return
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE document_chunks SET embedding_status='FAILED',
                      embedding_retry_count=embedding_retry_count+1,embedding_error_code=%s,
                      embedding_error_message=%s,embedding_claim_token=NULL,
                      embedding_processing_started_at=NULL,updated_at=NOW()
                    WHERE organization_id=%s AND document_id=%s AND id=ANY(%s)
                      AND embedding_claim_token=%s
                """, (error_code, message[:500], organization_id, document_id,
                      [chunk.id for chunk in chunks], chunks[0].claim_token))

    def restore_claims(self, *, organization_id: str, document_id: str,
                       configuration: EmbeddingConfiguration, chunks: list[EmbeddingChunk]) -> None:
        if not chunks:
            return
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE document_chunks c
                    SET embedding_status=CASE WHEN EXISTS (
                          SELECT 1 FROM document_chunk_embeddings e
                          WHERE e.organization_id=c.organization_id AND e.document_id=c.document_id
                            AND e.chunk_id=c.id AND e.content_fingerprint=c.content_fingerprint
                            AND e.embedding_configuration_fingerprint=%s
                            AND e.embedding_dimension=%s
                            AND vector_dims(e.embedding)=%s AND vector_norm(e.embedding)>0
                            AND (%s=false OR abs(vector_norm(e.embedding)-1.0)<=0.001)
                        ) THEN 'COMPLETED' ELSE 'PENDING' END,
                        embedding_claim_token=NULL,embedding_processing_started_at=NULL,updated_at=NOW()
                    WHERE c.organization_id=%s AND c.document_id=%s AND c.id=ANY(%s)
                      AND c.embedding_claim_token=%s
                """, (configuration.fingerprint, configuration.dimension, configuration.dimension,
                      configuration.normalize, organization_id,
                      document_id, [chunk.id for chunk in chunks], chunks[0].claim_token))

    def mark_job_failed(self, *, organization_id: str, document_id: str, job_id: str,
                        error_code: str, message: str) -> None:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE processing_jobs SET status='FAILED',failed_at=NOW(),error_code=%s,
                      error_message=%s,updated_at=NOW()
                    WHERE id=%s AND organization_id=%s AND document_id=%s
                """, (error_code, message[:500], job_id, organization_id, document_id))

    def finalize(self, *, organization_id: str, document_id: str, configuration: EmbeddingConfiguration,
                 summary: dict[str, Any], job_id: str | None = None) -> dict[str, int | bool]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                self._validate_document(cursor, organization_id, document_id)
                cursor.execute("""
                    SELECT count(*) total,
                      count(e.id) FILTER (WHERE c.embedding_status='COMPLETED') valid
                    FROM document_chunks c
                    LEFT JOIN document_chunk_embeddings e
                      ON e.organization_id=c.organization_id AND e.document_id=c.document_id
                     AND e.chunk_id=c.id AND e.chunk_index=c.chunk_index
                     AND e.content_fingerprint=c.content_fingerprint
                     AND e.embedding_configuration_fingerprint=%s
                     AND e.embedding_dimension=%s
                     AND vector_dims(e.embedding)=%s AND vector_norm(e.embedding)>0
                     AND (%s=false OR abs(vector_norm(e.embedding)-1.0)<=0.001)
                    WHERE c.organization_id=%s AND c.document_id=%s
                """, (configuration.fingerprint, configuration.dimension, configuration.dimension,
                      configuration.normalize, organization_id, document_id))
                counts = dict(cursor.fetchone())
                complete = counts["total"] > 0 and counts["valid"] == counts["total"]
                cursor.execute("UPDATE documents SET processing_stage=%s,updated_at=NOW() WHERE organization_id=%s AND id=%s", ("RETRIEVAL_READY" if complete else "EMBEDDING_FAILED", organization_id, document_id))
                if job_id:
                    cursor.execute("""
                        UPDATE processing_jobs SET result_metadata=COALESCE(result_metadata,'{}'::jsonb)
                          || jsonb_build_object('embedding',%s::jsonb),
                          status=%s,completed_at=CASE WHEN %s THEN NOW() ELSE completed_at END,
                          failed_at=CASE WHEN %s THEN failed_at ELSE NOW() END,
                          error_code=CASE WHEN %s THEN NULL ELSE 'EMBEDDING_INCOMPLETE' END,
                          error_message=CASE WHEN %s THEN NULL ELSE 'Not all current chunks have active embeddings' END,
                          updated_at=NOW()
                        WHERE id=%s AND organization_id=%s AND document_id=%s
                    """, (Json(summary), "COMPLETED" if complete else "FAILED", complete,
                          complete, complete, complete, job_id, organization_id, document_id))
                else:
                    cursor.execute("""
                        UPDATE processing_jobs SET result_metadata=COALESCE(result_metadata,'{}'::jsonb)
                          || jsonb_build_object('embedding',%s::jsonb),updated_at=NOW()
                        WHERE id=(SELECT id FROM processing_jobs WHERE organization_id=%s AND document_id=%s ORDER BY created_at DESC LIMIT 1)
                    """, (Json(summary), organization_id, document_id))
                return {**counts, "complete": complete}

    @staticmethod
    def _validate_document(cursor, organization_id: str, document_id: str) -> None:
        cursor.execute("SELECT id FROM documents WHERE organization_id=%s AND id=%s AND deleted_at IS NULL", (organization_id, document_id))
        if not cursor.fetchone():
            raise EmbeddingError("DOCUMENT_NOT_FOUND", "Document not found for organization")
