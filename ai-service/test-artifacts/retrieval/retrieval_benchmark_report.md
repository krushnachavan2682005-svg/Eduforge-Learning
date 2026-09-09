# Retrieval Benchmark Report

Generated: 2026-07-18T14:13:41.687657+00:00

## Overall results

| Mode | Recall@1 | Recall@3 | Recall@5 | Precision@5 | Hit@5 | MRR@5 | nDCG@5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| VECTOR | 0.8000 | 0.9111 | 0.9111 | 0.2044 | 0.9333 | 0.8963 | 0.8680 |
| LEXICAL | 0.3889 | 0.4222 | 0.4222 | 0.0889 | 0.4222 | 0.4111 | 0.4130 |
| HYBRID | 0.8444 | 0.9333 | 0.9333 | 0.2089 | 0.9556 | 0.9296 | 0.8984 |
| HYBRID_RERANK | 0.8667 | 0.9222 | 0.9222 | 0.2089 | 0.9333 | 0.9333 | 0.9029 |

## Acceptance

- PASS: tenant_leakage_zero
- PASS: deleted_leakage_zero
- PASS: forbidden_leakage_zero
- PASS: hybrid_identifier_hit_rate_5
- PASS: rerank_identifier_hit_rate_5
- PASS: hybrid_recall_not_below_vector
- PASS: rerank_mrr_not_below_hybrid
- PASS: rerank_ndcg_not_below_hybrid

Determinism mismatches: 0
Production snapshot equal after cleanup: True
