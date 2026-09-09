import re
import uuid

from app.config.settings import Settings
from app.retrieval.models import RetrievalError, RetrievalRequest


class RetrievalQueryValidator:
    def __init__(self, settings: Settings):
        self.settings = settings

    def validate(self, *, organization_id: str, query: str, top_k: int | None,
                 minimum_similarity: float | None, document_id: str | None = None,
                 document_ids: list[str] | None = None, include_content: bool = True,
                 retrieval_mode: str | None = None) -> RetrievalRequest:
        normalized_query = query.strip() if isinstance(query, str) else ""
        if not normalized_query:
            raise RetrievalError("RETRIEVAL_QUERY_EMPTY", "Retrieval query must not be empty")
        if len(normalized_query) > self.settings.retrieval_query_max_characters:
            raise RetrievalError("RETRIEVAL_QUERY_TOO_LONG", "Retrieval query exceeds the character limit")
        # This conservative pre-model guard prevents unbounded inference input. The provider
        # still performs the authoritative model tokenization while embedding.
        if len(re.findall(r"\S+", normalized_query)) > self.settings.retrieval_query_max_tokens:
            raise RetrievalError("RETRIEVAL_QUERY_TOO_LONG", "Retrieval query exceeds the token limit")
        selected_top_k = self.settings.retrieval_default_top_k if top_k is None else top_k
        if isinstance(selected_top_k, bool) or not isinstance(selected_top_k, int) or not 1 <= selected_top_k <= self.settings.retrieval_max_top_k:
            raise RetrievalError("RETRIEVAL_TOP_K_INVALID", "top_k is outside the configured range")
        threshold = self.settings.retrieval_default_min_similarity if minimum_similarity is None else minimum_similarity
        if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not -1.0 <= float(threshold) <= 1.0:
            raise RetrievalError("RETRIEVAL_THRESHOLD_INVALID", "minimum_similarity must be between -1 and 1")
        self._uuid(organization_id, "organization_id")
        if document_id and document_ids:
            raise RetrievalError("RETRIEVAL_DOCUMENT_FILTER_INVALID", "Use document_id or document_ids, not both")
        filters = [document_id] if document_id else list(document_ids or [])
        if len(filters) > self.settings.retrieval_max_document_filters:
            raise RetrievalError("RETRIEVAL_DOCUMENT_FILTER_INVALID", "Too many document filters")
        if len(filters) != len(set(filters)):
            raise RetrievalError("RETRIEVAL_DOCUMENT_FILTER_INVALID", "Duplicate document filters are not allowed")
        for value in filters:
            self._uuid(value, "document_id")
        if retrieval_mode is not None and retrieval_mode.upper() not in {"VECTOR", "LEXICAL", "HYBRID", "HYBRID_RERANK"}:
            raise RetrievalError("RETRIEVAL_MODE_INVALID", "Retrieval mode is invalid")
        return RetrievalRequest(organization_id, normalized_query, selected_top_k, float(threshold), filters,
                                include_content, retrieval_mode.upper() if retrieval_mode else None)

    @staticmethod
    def _uuid(value: str, field: str) -> None:
        try:
            uuid.UUID(value)
        except (ValueError, TypeError, AttributeError) as exc:
            raise RetrievalError("RETRIEVAL_DOCUMENT_FILTER_INVALID", f"Malformed {field}") from exc

