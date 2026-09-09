import time
import re
from typing import Any

from pgvector.psycopg import Vector, register_vector

from app.database.postgres import get_connection
from app.embeddings.configuration import EmbeddingConfiguration
from app.retrieval.models import RetrievalError


SEARCH_SQL = """
WITH candidates AS (
  SELECT d.id document_id,d.title document_title,c.id chunk_id,c.chunk_index,
         c.content,c.section_title,c.page_start,c.page_end,c.source_pages,
         c.content_types,c.source_block_ids,c.content_fingerprint,c.metadata,
         e.embedding <=> %(query_vector)s AS cosine_distance
  FROM documents d
  JOIN document_chunks c
    ON c.organization_id=%(organization_id)s AND c.organization_id=d.organization_id
   AND c.document_id=d.id
  JOIN document_chunk_embeddings e
    ON e.organization_id=%(organization_id)s AND e.organization_id=c.organization_id
   AND e.document_id=c.document_id AND e.chunk_id=c.id AND e.chunk_index=c.chunk_index
   AND e.content_fingerprint=c.content_fingerprint
  WHERE d.organization_id=%(organization_id)s AND d.deleted_at IS NULL
    AND d.status='COMPLETED' AND d.processing_stage='RETRIEVAL_READY'
    AND c.embedding_status='COMPLETED'
    AND e.embedding_configuration_fingerprint=%(configuration_fingerprint)s
    AND e.embedding_provider=%(provider)s AND e.embedding_model=%(model)s
    AND e.embedding_model_revision=%(model_revision)s
    AND e.embedding_dimension=%(dimension)s AND vector_dims(e.embedding)=%(dimension)s
    AND e.normalized=%(normalized)s AND vector_norm(e.embedding)>0
    AND (%(normalized)s=false OR abs(vector_norm(e.embedding)-1.0)<=0.001)
    AND (%(document_ids)s::uuid[] IS NULL OR d.id=ANY(%(document_ids)s::uuid[]))
), filtered AS (
  SELECT *, greatest(-1.0,least(1.0,1.0-cosine_distance)) similarity_score
  FROM candidates
  WHERE 1.0-cosine_distance >= %(minimum_similarity)s
)
SELECT * FROM filtered
ORDER BY cosine_distance ASC,document_id ASC,chunk_index ASC,chunk_id ASC
LIMIT %(top_k)s
"""

LEXICAL_SEARCH_SQL = """
WITH query AS (
  SELECT websearch_to_tsquery('english', %(query)s) english_query,
         plainto_tsquery('simple', %(query)s) simple_query
), candidates AS (
  SELECT d.id document_id,d.title document_title,c.id chunk_id,c.chunk_index,
         c.content,c.section_title,c.page_start,c.page_end,c.source_pages,
         c.content_types,c.source_block_ids,c.content_fingerprint,c.metadata,
         ts_rank_cd(c.lexical_search_english,q.english_query,32)
           + ts_rank_cd(c.lexical_search_simple,q.simple_query,32) lexical_score
  FROM query q
  JOIN document_chunks c ON
       (c.lexical_search_english @@ q.english_query OR c.lexical_search_simple @@ q.simple_query)
  JOIN documents d ON d.organization_id=%(organization_id)s
    AND d.organization_id=c.organization_id AND d.id=c.document_id
  WHERE c.organization_id=%(organization_id)s
    AND d.deleted_at IS NULL AND d.status='COMPLETED' AND d.processing_stage='RETRIEVAL_READY'
    AND c.embedding_status='COMPLETED'
    AND (%(document_ids)s::uuid[] IS NULL OR d.id=ANY(%(document_ids)s::uuid[]))
)
SELECT * FROM candidates
ORDER BY lexical_score DESC,document_id ASC,chunk_index ASC,chunk_id ASC
LIMIT %(top_k)s
"""


class PgVectorRetrievalRepository:
    def __init__(self, database_url: str, database_timeout_ms: int = 5000):
        self.database_url = database_url
        self.database_timeout_ms = database_timeout_ms

    def validate_document_filters(self, organization_id: str, document_ids: list[str]) -> None:
        if not document_ids:
            return
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT id,deleted_at,processing_stage,status FROM documents WHERE organization_id=%s AND id=ANY(%s::uuid[])", (organization_id, document_ids))
                rows = cursor.fetchall()
        if len(rows) != len(document_ids):
            raise RetrievalError("RETRIEVAL_DOCUMENT_NOT_FOUND", "One or more documents were not found", status_code=404)
        if any(row["deleted_at"] is not None for row in rows):
            raise RetrievalError("RETRIEVAL_DOCUMENT_NOT_FOUND", "One or more documents were not found", status_code=404)
        if any(row["processing_stage"] != "RETRIEVAL_READY" or row["status"] != "COMPLETED" for row in rows):
            raise RetrievalError("RETRIEVAL_DOCUMENT_NOT_READY", "One or more documents are not ready for retrieval", status_code=409)

    def eligible_embedding_count(self, organization_id: str, configuration: EmbeddingConfiguration,
                                 document_ids: list[str]) -> int:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                  SELECT count(*) total FROM documents d JOIN document_chunks c
                    ON c.organization_id=d.organization_id AND c.document_id=d.id
                  JOIN document_chunk_embeddings e ON e.organization_id=c.organization_id
                    AND e.document_id=c.document_id AND e.chunk_id=c.id AND e.chunk_index=c.chunk_index
                    AND e.content_fingerprint=c.content_fingerprint
                  WHERE d.organization_id=%s AND d.deleted_at IS NULL AND d.status='COMPLETED'
                    AND d.processing_stage='RETRIEVAL_READY' AND c.embedding_status='COMPLETED'
                    AND e.embedding_configuration_fingerprint=%s AND e.embedding_provider=%s
                    AND e.embedding_model=%s AND e.embedding_model_revision=%s
                    AND e.embedding_dimension=%s AND e.normalized=%s
                    AND vector_dims(e.embedding)=%s AND vector_norm(e.embedding)>0
                    AND (%s=false OR abs(vector_norm(e.embedding)-1.0)<=0.001)
                    AND (%s::uuid[] IS NULL OR d.id=ANY(%s::uuid[]))
                """, (organization_id, configuration.fingerprint, configuration.provider,
                      configuration.model, configuration.model_revision, configuration.dimension,
                      configuration.normalize, configuration.dimension, configuration.normalize,
                      document_ids or None, document_ids or None))
                return int(cursor.fetchone()["total"])

    def search_exact(self, *, organization_id: str, query_vector: list[float],
                     configuration: EmbeddingConfiguration, top_k: int,
                     minimum_similarity: float, document_ids: list[str]) -> tuple[list[dict[str, Any]], int]:
        started = time.monotonic()
        parameters = self._parameters(organization_id, query_vector, configuration, top_k, minimum_similarity, document_ids)
        try:
            with get_connection(self.database_url) as connection:
                register_vector(connection)
                with connection.cursor() as cursor:
                    cursor.execute("SELECT set_config('statement_timeout', %s, true)", (str(self.database_timeout_ms),))
                    cursor.execute(SEARCH_SQL, parameters)
                    rows = [dict(row) for row in cursor.fetchall()]
        except RetrievalError:
            raise
        except Exception as exc:
            raise RetrievalError("RETRIEVAL_DATABASE_ERROR", "Retrieval database query failed", status_code=503, retryable=True) from exc
        return rows, round((time.monotonic() - started) * 1000)

    def search_lexical(self, *, organization_id: str, query: str, top_k: int,
                       document_ids: list[str]) -> tuple[list[dict[str, Any]], int]:
        started = time.monotonic()
        try:
            with get_connection(self.database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT set_config('statement_timeout', %s, true)", (str(self.database_timeout_ms),))
                    cursor.execute(LEXICAL_SEARCH_SQL, {"organization_id": organization_id, "query": query,
                                                       "top_k": top_k, "document_ids": document_ids or None})
                    rows = [dict(row) for row in cursor.fetchall()]
        except Exception as exc:
            raise RetrievalError("LEXICAL_RETRIEVAL_DATABASE_ERROR", "Lexical retrieval query failed", status_code=503, retryable=True) from exc
        return rows, round((time.monotonic() - started) * 1000)

    def explain_lexical(self, *, organization_id: str, query: str, top_k: int,
                        document_ids: list[str]) -> list[str]:
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + LEXICAL_SEARCH_SQL,
                               {"organization_id": organization_id, "query": query, "top_k": top_k,
                                "document_ids": document_ids or None})
                return [row["QUERY PLAN"] for row in cursor.fetchall()]

    def load_evidence_blocks(self, *, organization_id: str, result_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        block_ids = sorted({str(block_id) for row in result_rows for block_id in row.get("source_block_ids") or []})
        if not block_ids:
            return {}
        document_ids = sorted({str(row["document_id"]) for row in result_rows})
        with get_connection(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("""
                  SELECT b.id,b.organization_id,b.document_id,b.page_number,b.block_order,b.block_type,b.source_type,
                    b.page_text_id,b.table_id,b.image_id,b.image_text_id,
                    coalesce(b.readable_text,b.content_text,'') block_text,b.metadata,
                    EXISTS (
                      SELECT 1 FROM document_content_blocks marker
                      WHERE marker.organization_id=b.organization_id AND marker.document_id=b.document_id
                        AND marker.page_number=b.page_number
                        AND coalesce(marker.readable_text,marker.content_text,'')
                          ~* '(validation checklist|expected values|ground.?truth|expected facts)'
                    ) reference_page
                  FROM document_content_blocks b
                  WHERE b.organization_id=%s AND b.document_id=ANY(%s::uuid[]) AND b.id=ANY(%s::uuid[])
                  ORDER BY b.document_id,b.page_number,b.block_order,b.id
                """, (organization_id, document_ids, block_ids))
                return {str(row["id"]): dict(row) for row in cursor.fetchall()}

    def explain_exact(self, *, organization_id: str, query_vector: list[float], configuration: EmbeddingConfiguration,
                      top_k: int, minimum_similarity: float, document_ids: list[str]) -> list[str]:
        parameters = self._parameters(organization_id, query_vector, configuration, top_k, minimum_similarity, document_ids)
        with get_connection(self.database_url) as connection:
            register_vector(connection)
            with connection.cursor() as cursor:
                cursor.execute("EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + SEARCH_SQL, parameters)
                return [re.sub(r"'\[[^]]+\]'::vector", "'[REDACTED_VECTOR]'::vector", row["QUERY PLAN"])
                        for row in cursor.fetchall()]

    @staticmethod
    def _parameters(organization_id, query_vector, configuration, top_k, minimum_similarity, document_ids):
        return {"organization_id": organization_id, "query_vector": Vector(query_vector),
                "configuration_fingerprint": configuration.fingerprint, "provider": configuration.provider,
                "model": configuration.model, "model_revision": configuration.model_revision,
                "dimension": configuration.dimension, "normalized": configuration.normalize,
                "document_ids": document_ids or None, "minimum_similarity": minimum_similarity, "top_k": top_k}
