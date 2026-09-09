# Retrieval production rollout

The production default is `RAG_RETRIEVAL_MODE=HYBRID` with `RAG_RERANK_ENABLED=false`.
This improves the accepted benchmark Recall@5 (0.9333 vs 0.9111), MRR@5 (0.9296 vs
0.8963), and nDCG@5 (0.8984 vs 0.8680) relative to VECTOR while keeping warm p95
comparable (about 906 ms vs 953 ms).

HYBRID_RERANK remains opt-in with both `RAG_RETRIEVAL_MODE=HYBRID_RERANK` and
`RAG_RERANK_ENABLED=true`. Its accepted MRR@5 is 0.9333 and nDCG@5 is 0.9029,
but Recall@5 is 0.9222 and warm p95 is about 1,734 ms, so it is not the production
default. When HYBRID_RERANK is requested while reranking is disabled, execution
falls back deterministically to HYBRID with `RERANKER_DISABLED` diagnostics.

Emergency rollback requires only `RAG_RETRIEVAL_MODE=VECTOR`; restart the Python
service and verify the sanitized `RAG_RETRIEVAL_CONFIGURATION` startup event.
LEXICAL remains available as an explicit diagnostics/evaluation mode.

Retrieval diagnostics are persisted under `rag_observability_events.metadata.retrieval`.
They contain bounded modes, counts, cache flags, safe fallback codes, and monotonic
stage timings only. Dense and lexical SQL currently execute sequentially;
`totalRetrievalMs` is independently measured and is not computed by summing stages.
No query, evidence, prompt, answer, vector, credential, or exception text is allowed.
