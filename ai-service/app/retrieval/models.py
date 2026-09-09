import math
from dataclasses import asdict, dataclass
from typing import Any


RETRIEVAL_MODES = frozenset({"VECTOR", "LEXICAL", "HYBRID", "HYBRID_RERANK"})
RERANKER_FALLBACK_REASONS = frozenset({
    "RERANKER_DISABLED", "RERANKER_UNAVAILABLE", "RERANKER_TIMEOUT",
    "RERANKER_INVALID_SCORE", "RERANKER_INITIALIZATION_FAILED",
    "LEXICAL_UNAVAILABLE", "VECTOR_UNAVAILABLE", "CONFIGURED_VECTOR_ROLLBACK",
})


@dataclass(frozen=True)
class RetrievalDiagnostics:
    requested_mode: str
    effective_mode: str
    reranker_requested: bool
    reranker_applied: bool
    reranker_fallback_reason: str | None = None
    vector_candidate_count: int | None = None
    lexical_candidate_count: int | None = None
    fused_candidate_count: int | None = None
    rerank_candidate_count: int | None = None
    final_evidence_count: int | None = None
    duplicate_suppression_count: int | None = None
    query_embedding_cache_hit: bool | None = None
    reranker_cache_hit: bool | None = None
    normalization_ms: float | None = None
    query_embedding_ms: float | None = None
    vector_sql_ms: float | None = None
    lexical_sql_ms: float | None = None
    fusion_ms: float | None = None
    deduplication_ms: float | None = None
    reranker_ms: float | None = None
    evidence_mapping_ms: float | None = None
    total_retrieval_ms: float | None = None

    def __post_init__(self) -> None:
        if self.requested_mode not in RETRIEVAL_MODES or self.effective_mode not in RETRIEVAL_MODES:
            raise ValueError("invalid retrieval diagnostics mode")
        if self.reranker_fallback_reason not in RERANKER_FALLBACK_REASONS | {None}:
            raise ValueError("invalid retrieval fallback reason")
        counts = (self.vector_candidate_count, self.lexical_candidate_count, self.fused_candidate_count,
                  self.rerank_candidate_count, self.final_evidence_count, self.duplicate_suppression_count)
        if any(value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0) for value in counts):
            raise ValueError("retrieval diagnostic counts must be non-negative integers")
        timings = (self.normalization_ms, self.query_embedding_ms, self.vector_sql_ms, self.lexical_sql_ms,
                   self.fusion_ms, self.deduplication_ms, self.reranker_ms, self.evidence_mapping_ms,
                   self.total_retrieval_ms)
        if any(value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0) for value in timings):
            raise ValueError("retrieval diagnostic timings must be non-negative numbers")

    def to_dict(self) -> dict[str, Any]:
        names = {
            "requested_mode": "requestedMode", "effective_mode": "effectiveMode",
            "reranker_requested": "rerankerRequested", "reranker_applied": "rerankerApplied",
            "reranker_fallback_reason": "rerankerFallbackReason", "vector_candidate_count": "vectorCandidateCount",
            "lexical_candidate_count": "lexicalCandidateCount", "fused_candidate_count": "fusedCandidateCount",
            "rerank_candidate_count": "rerankCandidateCount", "final_evidence_count": "finalEvidenceCount",
            "duplicate_suppression_count": "duplicateSuppressionCount", "query_embedding_cache_hit": "queryEmbeddingCacheHit",
            "reranker_cache_hit": "rerankerCacheHit", "normalization_ms": "normalizationMs",
            "query_embedding_ms": "queryEmbeddingMs", "vector_sql_ms": "vectorSqlMs",
            "lexical_sql_ms": "lexicalSqlMs", "fusion_ms": "fusionMs", "deduplication_ms": "deduplicationMs",
            "reranker_ms": "rerankerMs", "evidence_mapping_ms": "evidenceMappingMs",
            "total_retrieval_ms": "totalRetrievalMs",
        }
        return {names[key]: value for key, value in asdict(self).items()}


class RetrievalError(RuntimeError):
    def __init__(self, error_code: str, message: str, *, status_code: int = 400, retryable: bool = False,
                 diagnostics: dict[str, Any] | None = None):
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.diagnostics = diagnostics


@dataclass(frozen=True)
class RetrievalRequest:
    organization_id: str
    query: str
    top_k: int
    minimum_similarity: float
    document_ids: list[str]
    include_content: bool = True
    retrieval_mode: str | None = None


@dataclass(frozen=True)
class RetrievalEvidence:
    evidence_id: str
    content_block_id: str
    source_record_type: str
    source_record_id: str | None
    page_number: int
    block_type: str
    section_title: str | None
    table_id: str | None
    image_id: str | None
    image_text_id: str | None
    text_start: int | None
    text_end: int | None
    matched_text: str | None
    evidence_role: str
    evidence_score: float
    provenance_confidence: float
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]: return asdict(self)


@dataclass(frozen=True)
class RetrievalResult:
    rank: int
    similarity_score: float
    cosine_distance: float
    document_id: str
    document_title: str
    chunk_id: int
    chunk_index: int
    content: str | None
    section_title: str | None
    page_start: int
    page_end: int
    source_pages: list[int]
    content_types: list[str]
    source_block_ids: list[str]
    content_fingerprint: str
    metadata: dict[str, Any]
    primary_evidence_page: int | None
    evidence_pages: list[int]
    secondary_reference_pages: list[int]
    citation_precision: str
    evidence: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
