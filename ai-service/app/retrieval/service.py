import hashlib
import logging
import threading
import time
import uuid
from typing import Any

from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import EmbeddingError
from app.embeddings.provider import EmbeddingProvider
from app.embeddings.validator import EmbeddingVectorValidator
from app.retrieval.evidence_mapper import EvidenceMapper
from app.retrieval.hybrid import HybridConfiguration, fuse, normalize_query, suppress_duplicates
from app.retrieval.models import RetrievalDiagnostics, RetrievalError, RetrievalRequest, RetrievalResult
from app.retrieval.query_cache import QueryEmbeddingCache
from app.retrieval.repository import PgVectorRetrievalRepository

logger = logging.getLogger(__name__)


class RetrievalService:
    def __init__(self, *, repository: PgVectorRetrievalRepository, provider: EmbeddingProvider,
                 configuration: EmbeddingConfiguration, max_concurrent_requests: int = 4,
                 slow_query_threshold_ms: int = 500, model_busy_timeout_ms: int = 0,
                 query_cache: QueryEmbeddingCache | None = None,
                 hybrid_configuration: HybridConfiguration | None = None, reranker=None,
                 query_max_characters: int = 2000):
        self.repository, self.provider, self.configuration = repository, provider, configuration
        self.validator = EmbeddingVectorValidator(dimension=configuration.dimension, normalized=configuration.normalize)
        self._capacity = threading.BoundedSemaphore(max_concurrent_requests)
        self.concurrency_limit = max_concurrent_requests; self._model_lock = threading.Lock()
        self.slow_query_threshold_ms = slow_query_threshold_ms; self.evidence_mapper = EvidenceMapper()
        self.model_busy_timeout_ms = model_busy_timeout_ms
        self.query_cache = query_cache or QueryEmbeddingCache(enabled=False, max_entries=1, ttl_seconds=1)
        self.hybrid = (hybrid_configuration or HybridConfiguration(mode="VECTOR")).validate()
        self.reranker = reranker; self.query_max_characters = query_max_characters

    def _embed(self, query: str, organization_id: str, fingerprint: str) -> tuple[list[float], int, bool]:
        started = time.monotonic()
        cache_key = hashlib.sha256(f"{organization_id}:{fingerprint}:{self.configuration.fingerprint}".encode()).hexdigest()
        vector = self.query_cache.get(cache_key); cache_hit = vector is not None; acquired = False
        try:
            if vector is None:
                acquired = self._capacity.acquire(timeout=self.model_busy_timeout_ms / 1000)
                if not acquired: raise RetrievalError("RETRIEVAL_SERVICE_BUSY", "Retrieval model capacity is exhausted", status_code=503, retryable=True)
                with self._model_lock: vector = self.provider.embed_query(query)
                vector = self.validator.validate_vector(vector); self.query_cache.put(cache_key, vector)
            else: vector = self.validator.validate_vector(vector)
        except EmbeddingError as exc:
            vector_codes = {"EMBEDDING_VECTOR_INVALID", "EMBEDDING_DIMENSION_MISMATCH", "EMBEDDING_NON_FINITE_VALUE",
                            "EMBEDDING_ZERO_VECTOR", "EMBEDDING_NORMALIZATION_FAILED"}
            code = "QUERY_VECTOR_INVALID" if exc.error_code in vector_codes else "QUERY_EMBEDDING_FAILED"
            raise RetrievalError(code, "Query embedding could not be generated or validated", status_code=422, retryable=exc.retryable) from exc
        finally:
            if acquired: self._capacity.release()
        return vector, round((time.monotonic() - started) * 1000), cache_hit

    def search(self, request: RetrievalRequest, *, correlation_id: str = "missing-request-id") -> dict[str, Any]:
        started = time.monotonic(); normalization_started = time.monotonic()
        query = normalize_query(request.query, self.query_max_characters)
        normalization_ms = round((time.monotonic() - normalization_started) * 1000, 3)
        fingerprint = hashlib.sha256(query.encode()).hexdigest()
        requested_mode = (request.retrieval_mode or self.hybrid.mode).upper()
        if requested_mode not in {"VECTOR", "LEXICAL", "HYBRID", "HYBRID_RERANK"}:
            raise RetrievalError("RETRIEVAL_MODE_INVALID", "Retrieval mode is invalid", status_code=422)
        effective_mode = requested_mode
        values: dict[str, Any] = {
            "requested_mode": requested_mode, "effective_mode": effective_mode,
            "reranker_requested": requested_mode == "HYBRID_RERANK", "reranker_applied": False,
            "normalization_ms": normalization_ms,
        }
        def diagnostics(*, complete: bool = False) -> dict[str, Any]:
            values["effective_mode"] = effective_mode
            if complete: values["total_retrieval_ms"] = round((time.monotonic() - started) * 1000, 3)
            return RetrievalDiagnostics(**values).to_dict()
        try:
            self.repository.validate_document_filters(request.organization_id, request.document_ids)
            vector_rows: list[dict[str, Any]] = []; lexical_rows: list[dict[str, Any]] = []
            embedding_ms = vector_ms = lexical_ms = fusion_ms = reranking_ms = None
            cache_hit = False; fallback_reason = None; reranker_applied = False; effective_mode = requested_mode
            if requested_mode != "LEXICAL":
                eligible = self.repository.eligible_embedding_count(request.organization_id, self.configuration, request.document_ids)
                if eligible == 0: raise RetrievalError("ACTIVE_EMBEDDING_CONFIGURATION_NOT_AVAILABLE", "No eligible embeddings exist for the active configuration", status_code=409)
                embedding_started = time.monotonic()
                try: vector, embedding_ms, cache_hit = self._embed(query, request.organization_id, fingerprint)
                except RetrievalError:
                    values["query_embedding_ms"] = round((time.monotonic() - embedding_started) * 1000, 3)
                    raise
                values.update(query_embedding_ms=embedding_ms, query_embedding_cache_hit=cache_hit)
                vector_started = time.monotonic()
                try:
                    vector_rows, vector_ms = self.repository.search_exact(organization_id=request.organization_id,
                        query_vector=vector, configuration=self.configuration, top_k=self.hybrid.vector_candidate_k,
                        minimum_similarity=request.minimum_similarity, document_ids=request.document_ids)
                except Exception:
                    values["vector_sql_ms"] = round((time.monotonic() - vector_started) * 1000, 3)
                    raise
                values.update(vector_sql_ms=vector_ms, vector_candidate_count=len(vector_rows))
            else: eligible = 0
            if requested_mode != "VECTOR":
                try:
                    lexical_started = time.monotonic()
                    try:
                        lexical_rows, lexical_ms = self.repository.search_lexical(organization_id=request.organization_id,
                            query=query, top_k=self.hybrid.lexical_candidate_k, document_ids=request.document_ids)
                    except Exception:
                        values["lexical_sql_ms"] = round((time.monotonic() - lexical_started) * 1000, 3)
                        raise
                    values.update(lexical_sql_ms=lexical_ms, lexical_candidate_count=len(lexical_rows))
                except RetrievalError as exc:
                    if requested_mode in {"HYBRID", "HYBRID_RERANK"}:
                        fallback_reason = "LEXICAL_UNAVAILABLE"; effective_mode = "VECTOR"
                    else: raise
            fusion_started = time.monotonic()
            if effective_mode == "VECTOR":
                rows = [dict(row, vector_score=float(row["similarity_score"]), vector_rank=i,
                             lexical_score=None, lexical_rank=None, fusion_score=None, fusion_rank=None,
                             retrieval_source="VECTOR") for i, row in enumerate(vector_rows, 1)]
            elif requested_mode == "LEXICAL":
                rows = [dict(row, similarity_score=0.0, cosine_distance=1.0, vector_score=None, vector_rank=None,
                             lexical_rank=i, fusion_score=None, fusion_rank=None, retrieval_source="LEXICAL")
                        for i, row in enumerate(lexical_rows, 1)]
            else: rows = fuse(vector_rows, lexical_rows, self.hybrid)
            if effective_mode not in {"VECTOR", "LEXICAL"}:
                fusion_ms = round((time.monotonic() - fusion_started) * 1000, 3)
                values["fusion_ms"] = fusion_ms
            fused_count = len(rows)
            values["fused_candidate_count"] = fused_count if effective_mode not in {"VECTOR", "LEXICAL"} else None
            rerank_candidate_count = None
            if requested_mode == "HYBRID_RERANK" and effective_mode != "VECTOR" and self.reranker is None:
                fallback_reason = "RERANKER_DISABLED"; effective_mode = "HYBRID"
            elif requested_mode == "HYBRID_RERANK" and effective_mode != "VECTOR" and self.reranker is not None:
                rerank_started = time.monotonic()
                rerank_candidate_count = min(len(rows), self.hybrid.rerank_candidate_k)
                values["rerank_candidate_count"] = rerank_candidate_count
                try:
                    rows = self.reranker.rerank(query, rows[:self.hybrid.rerank_candidate_k]); reranker_applied = True
                except Exception as exc:
                    logger.warning("RETRIEVAL_RERANK_FALLBACK correlation_id=%s reason=%s", correlation_id, type(exc).__name__)
                    fallback_reason = "RERANKER_TIMEOUT" if isinstance(exc, TimeoutError) else ("RERANKER_INVALID_SCORE" if isinstance(exc, ValueError) else "RERANKER_UNAVAILABLE")
                    effective_mode = "HYBRID"
                reranking_ms = round((time.monotonic() - rerank_started) * 1000, 3)
                values["reranker_ms"] = reranking_ms
            dedup_started = time.monotonic()
            rows, duplicate_count = suppress_duplicates(rows, min(request.top_k, self.hybrid.final_top_k))
            dedup_ms = round((time.monotonic() - dedup_started) * 1000, 3)
            values.update(deduplication_ms=dedup_ms, duplicate_suppression_count=duplicate_count)
            evidence_started = time.monotonic(); seen: set[str] = set()
            blocks = self.repository.load_evidence_blocks(organization_id=request.organization_id, result_rows=rows)
            mapped = [self.evidence_mapper.map_result(organization_id=request.organization_id, query=query, row=row, blocks=blocks, seen=seen) for row in rows]
            evidence_ms = round((time.monotonic() - evidence_started) * 1000)
            values.update(evidence_mapping_ms=evidence_ms, final_evidence_count=len(rows),
                          reranker_applied=reranker_applied, reranker_fallback_reason=fallback_reason)
            results = []
            for index, row in enumerate(rows):
                result = self._result(index + 1, row, request.include_content, mapped[index]).to_dict()
                for name in ("vector_score", "vector_rank", "lexical_score", "lexical_rank", "fusion_score", "fusion_rank", "reranker_score", "reranker_rank", "retrieval_source", "duplicate_suppressed"):
                    result[name] = row.get(name)
                result["effective_retrieval_mode"] = effective_mode; results.append(result)
            total_ms = round((time.monotonic() - started) * 1000)
            timings = {"normalization_ms": normalization_ms, "query_embedding_ms": embedding_ms, "vector_sql_ms": vector_ms,
                       "lexical_sql_ms": lexical_ms, "fusion_ms": fusion_ms, "deduplication_ms": dedup_ms,
                       "reranking_ms": reranking_ms, "evidence_mapping_ms": evidence_ms, "total_retrieval_ms": total_ms}
            logger.info(f"pgvector Retrieval completed in {total_ms}ms", extra={"latency_ms": total_ms})
            return {"query_id": str(uuid.uuid4()), "query_fingerprint": fingerprint, "provider": self.configuration.provider,
                    "model": self.configuration.model, "model_revision": self.configuration.model_revision,
                    "configuration_fingerprint": self.configuration.fingerprint, "dimension": self.configuration.dimension,
                    "search_mode": effective_mode.lower(), "requested_retrieval_mode": requested_mode,
                    "effective_retrieval_mode": effective_mode, "reranker_applied": reranker_applied,
                    "reranker_fallback_reason": fallback_reason, "top_k": request.top_k,
                    "minimum_similarity": request.minimum_similarity, "eligible_embedding_count": eligible,
                    "vector_candidate_count": len(vector_rows), "lexical_candidate_count": len(lexical_rows),
                    "fused_candidate_count": fused_count, "reranked_candidate_count": rerank_candidate_count,
                    "duplicate_suppression_count": duplicate_count, "final_evidence_count": len(rows),
                    "result_count": len(results), "duration_ms": total_ms, "embedding_duration_ms": embedding_ms,
                    "database_duration_ms": sum(x for x in (vector_ms, lexical_ms) if x is not None), "evidence_mapping_duration_ms": evidence_ms,
                    "cache_hit": cache_hit, "timings": timings, "retrieval_diagnostics": diagnostics(complete=True), "results": results}
        except RetrievalError as exc:
            if exc.diagnostics is None: exc.diagnostics = diagnostics(complete=True)
            raise
        except Exception as exc:
            raise RetrievalError("RETRIEVAL_INTERNAL_DEPENDENCY_UNAVAILABLE", "Retrieval dependency failed", status_code=503,
                                 retryable=True, diagnostics=diagnostics(complete=True)) from exc

    def runtime_info(self) -> dict[str, Any]:
        provider_info = self.provider.runtime_info() if hasattr(self.provider, "runtime_info") else {}
        reranker_info = self.reranker.runtime_info() if self.reranker is not None else {"reranker_loaded": False}
        return {**provider_info, **reranker_info, **self.query_cache.stats(), "concurrency_limit": self.concurrency_limit,
                "retrieval_mode": self.hybrid.mode}

    @staticmethod
    def _result(rank: int, row: dict[str, Any], include_content: bool, citation: dict[str, Any]) -> RetrievalResult:
        similarity = float(row.get("similarity_score", row.get("vector_score") or 0.0))
        distance = float(row.get("cosine_distance", 1.0 - similarity))
        return RetrievalResult(rank, round(similarity, 8), round(distance, 8), str(row["document_id"]), row["document_title"],
            int(row["chunk_id"]), int(row["chunk_index"]), row["content"] if include_content else None, row["section_title"],
            int(row["page_start"]), int(row["page_end"]), list(row["source_pages"] or []), list(row["content_types"] or []),
            [str(x) for x in row["source_block_ids"] or []], row["content_fingerprint"].strip(), dict(row["metadata"] or {}),
            citation["primary_evidence_page"], citation["evidence_pages"], citation["secondary_reference_pages"],
            citation["citation_precision"], citation["evidence"])
