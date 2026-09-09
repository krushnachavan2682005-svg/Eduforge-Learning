import math
from collections import defaultdict
from statistics import mean
from typing import Any


def metrics(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute quality over answerable cases only; no-evidence behavior is separate."""
    answerable = [case for case in cases if case.get("answerable", True)]
    if not answerable: return {name: 0.0 for name in ("recall_at_1", "recall_at_3", "recall_at_5", "precision_at_5", "hit_rate_at_5", "mrr_at_5", "ndcg_at_5")}
    recall = {1: [], 3: [], 5: []}; precision5 = []; hits = []; reciprocal = []; ndcgs = []
    for case in answerable:
        relevant = set(case.get("relevant_chunk_ids", [])); ranked = list(case.get("ranked_chunk_ids", []))[:5]
        for k in recall: recall[k].append(len(relevant.intersection(ranked[:k])) / len(relevant) if relevant else 0.0)
        precision5.append(len(relevant.intersection(ranked)) / 5)
        positions = [i + 1 for i, chunk in enumerate(ranked) if chunk in relevant]
        hits.append(float(bool(positions))); reciprocal.append(1 / min(positions) if positions else 0)
        grades = case.get("graded_relevance") or {str(chunk): 1 for chunk in relevant}
        dcg = sum((2 ** float(grades.get(str(chunk), 0)) - 1) / math.log2(i + 2) for i, chunk in enumerate(ranked))
        ideal = sorted((float(value) for value in grades.values()), reverse=True)[:5]
        idcg = sum((2 ** grade - 1) / math.log2(i + 2) for i, grade in enumerate(ideal))
        ndcgs.append(dcg / idcg if idcg else 0.0)
    return {"recall_at_1": mean(recall[1]), "recall_at_3": mean(recall[3]), "recall_at_5": mean(recall[5]),
            "precision_at_5": mean(precision5), "hit_rate_at_5": mean(hits), "mrr_at_5": mean(reciprocal),
            "ndcg_at_5": mean(ndcgs)}


def reciprocal_rank(ranked: list[Any], relevant: set[Any], k: int = 5) -> float:
    return next((1.0 / rank for rank, item in enumerate(ranked[:k], 1) if item in relevant), 0.0)


def dcg_at_k(grades: list[float], k: int = 5) -> float:
    return sum((2 ** grade - 1) / math.log2(rank + 1) for rank, grade in enumerate(grades[:k], 1))


def ndcg_at_k(ranked_grades: list[float], ideal_grades: list[float], k: int = 5) -> float:
    ideal = dcg_at_k(sorted(ideal_grades, reverse=True), k)
    return dcg_at_k(ranked_grades, k) / ideal if ideal else 0.0


def category_metrics(cases: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped = defaultdict(list)
    for case in cases: grouped[case["category"]].append(case)
    return {category: metrics(items) for category, items in sorted(grouped.items())}
