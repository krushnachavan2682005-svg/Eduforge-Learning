import logging
import threading

from app.config.settings import Settings, get_settings
from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.sentence_transformer_provider import SentenceTransformerEmbeddingProvider
from app.retrieval.query_validator import RetrievalQueryValidator
from app.retrieval.repository import PgVectorRetrievalRepository
from app.retrieval.service import RetrievalService
from app.retrieval.query_cache import QueryEmbeddingCache
from app.retrieval.hybrid import HybridConfiguration
from app.retrieval.reranker import CrossEncoderReranker

_lock = threading.Lock()
_components = None
logger = logging.getLogger(__name__)


def get_retrieval_components(settings: Settings | None = None):
    global _components
    if _components is None:
        with _lock:
            if _components is None:
                selected = settings or get_settings()
                configuration = EmbeddingConfiguration.from_settings(selected)
                if configuration.provider != "sentence_transformers":
                    raise ValueError(f"Unsupported embedding provider: {configuration.provider}")
                provider = SentenceTransformerEmbeddingProvider(configuration)
                repository = PgVectorRetrievalRepository(selected.database_url, selected.retrieval_database_timeout_ms)
                hybrid = HybridConfiguration(mode=selected.rag_retrieval_mode,
                    vector_candidate_k=selected.rag_vector_candidate_k, lexical_candidate_k=selected.rag_lexical_candidate_k,
                    fusion_candidate_k=selected.rag_fusion_candidate_k, rerank_candidate_k=selected.rag_rerank_candidate_k,
                    final_top_k=selected.rag_final_top_k, rrf_k=selected.rag_rrf_k,
                    vector_weight=selected.rag_vector_weight, lexical_weight=selected.rag_lexical_weight).validate()
                if selected.rag_rerank_timeout_ms < 1:
                    raise ValueError("RAG_RERANK_TIMEOUT_MS must be positive")
                if selected.rag_rerank_enabled and (not selected.rag_rerank_model.strip() or not selected.rag_rerank_model_revision.strip()):
                    raise ValueError("reranker model identity and revision are required when reranking is enabled")
                reranker = CrossEncoderReranker(selected.rag_rerank_model, selected.rag_rerank_model_revision,
                    selected.rag_rerank_batch_size) if selected.rag_rerank_enabled else None
                logger.info("RAG_RETRIEVAL_CONFIGURATION", extra={
                    "configured_mode": hybrid.mode, "reranker_enabled": selected.rag_rerank_enabled,
                    "embedding_model": selected.embedding_model, "embedding_revision": selected.embedding_model_revision,
                    "reranker_model": selected.rag_rerank_model if selected.rag_rerank_enabled else None,
                    "reranker_revision": selected.rag_rerank_model_revision if selected.rag_rerank_enabled else None,
                    "vector_candidate_k": hybrid.vector_candidate_k, "lexical_candidate_k": hybrid.lexical_candidate_k,
                    "fusion_candidate_k": hybrid.fusion_candidate_k, "rerank_candidate_k": hybrid.rerank_candidate_k,
                    "final_top_k": hybrid.final_top_k, "rrf_k": hybrid.rrf_k,
                    "vector_weight": hybrid.vector_weight, "lexical_weight": hybrid.lexical_weight,
                })
                service = RetrievalService(repository=repository, provider=provider, configuration=configuration,
                    max_concurrent_requests=selected.retrieval_max_concurrent_requests,
                    slow_query_threshold_ms=selected.retrieval_slow_query_threshold_ms,
                    model_busy_timeout_ms=selected.retrieval_model_busy_timeout_ms,
                    query_cache=QueryEmbeddingCache(enabled=selected.retrieval_query_cache_enabled,
                        max_entries=selected.retrieval_query_cache_max_entries,
                        ttl_seconds=selected.retrieval_query_cache_ttl_seconds), hybrid_configuration=hybrid,
                    reranker=reranker, query_max_characters=selected.retrieval_query_max_characters)
                _components = (RetrievalQueryValidator(selected), service, repository, configuration)
    return _components
