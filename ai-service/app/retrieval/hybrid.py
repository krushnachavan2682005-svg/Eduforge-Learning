import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass
from typing import Any


MODES = {"VECTOR", "LEXICAL", "HYBRID", "HYBRID_RERANK"}


@dataclass(frozen=True)
class HybridConfiguration:
    mode: str = "HYBRID_RERANK"
    vector_candidate_k: int = 30
    lexical_candidate_k: int = 30
    fusion_candidate_k: int = 20
    rerank_candidate_k: int = 12
    final_top_k: int = 5
    rrf_k: int = 60
    vector_weight: float = 1.0
    lexical_weight: float = 1.0

    def validate(self) -> "HybridConfiguration":
        if self.mode not in MODES:
            raise ValueError("RAG_RETRIEVAL_MODE must be VECTOR, LEXICAL, HYBRID, or HYBRID_RERANK")
        values = (self.vector_candidate_k, self.lexical_candidate_k, self.fusion_candidate_k,
                  self.rerank_candidate_k, self.final_top_k)
        if any(value < 1 or value > 200 for value in values):
            raise ValueError("retrieval candidate limits must be between 1 and 200")
        if (self.final_top_k > self.fusion_candidate_k or self.rerank_candidate_k > self.fusion_candidate_k
                or self.final_top_k > self.rerank_candidate_k):
            raise ValueError("final/rerank candidate limits cannot exceed fusion candidate limit")
        if self.rrf_k < 1 or self.rrf_k > 10000 or self.vector_weight < 0 or self.lexical_weight < 0:
            raise ValueError("invalid RRF configuration")
        return self


def normalize_query(value: str, max_characters: int) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized[:max_characters]


def fuse(vector_rows: list[dict[str, Any]], lexical_rows: list[dict[str, Any]], config: HybridConfiguration) -> list[dict[str, Any]]:
    combined: dict[int, dict[str, Any]] = {}
    for source, rows, weight in (("vector", vector_rows, config.vector_weight),
                                 ("lexical", lexical_rows, config.lexical_weight)):
        for rank, original in enumerate(rows, 1):
            chunk_id = int(original["chunk_id"])
            row = combined.setdefault(chunk_id, dict(original))
            row[f"{source}_rank"] = rank
            row[f"{source}_score"] = float(original["similarity_score"] if source == "vector" else original["lexical_score"])
            row["fusion_score"] = row.get("fusion_score", 0.0) + weight / (config.rrf_k + rank)
    for row in combined.values():
        row.setdefault("vector_rank", None); row.setdefault("vector_score", None)
        row.setdefault("lexical_rank", None); row.setdefault("lexical_score", None)
        row["retrieval_source"] = "BOTH" if row["vector_rank"] and row["lexical_rank"] else ("VECTOR" if row["vector_rank"] else "LEXICAL")
    ordered = sorted(combined.values(), key=lambda row: (
        -row["fusion_score"], min(x for x in (row["vector_rank"], row["lexical_rank"]) if x is not None),
        -max(x for x in (row["vector_score"], row["lexical_score"]) if x is not None),
        str(row["document_id"]), int(row["chunk_index"]), int(row["chunk_id"])))
    for rank, row in enumerate(ordered, 1): row["fusion_rank"] = rank
    return ordered[:config.fusion_candidate_k]


def suppress_duplicates(rows: list[dict[str, Any]], limit: int) -> tuple[list[dict[str, Any]], int]:
    selected: list[dict[str, Any]] = []
    fingerprints: set[str] = set()
    removed = 0
    for row in rows:
        normalized = re.sub(r"\s+", " ", (row.get("content") or "").casefold()).strip()
        fingerprint = (row.get("content_fingerprint") or hashlib.sha256(normalized.encode()).hexdigest()).strip()
        duplicate = fingerprint in fingerprints
        if not duplicate:
            tokens = set(re.findall(r"\w+", normalized))
            for prior in selected:
                if str(prior["document_id"]) != str(row["document_id"]): continue
                prior_tokens = set(re.findall(r"\w+", (prior.get("content") or "").casefold()))
                union = len(tokens | prior_tokens)
                if union and len(tokens & prior_tokens) / union >= 0.90:
                    duplicate = True; break
        if duplicate:
            row["duplicate_suppressed"] = True; removed += 1; continue
        row["duplicate_suppressed"] = False
        fingerprints.add(fingerprint); selected.append(row)
        if len(selected) >= limit: break
    return selected, removed


def validate_scores(values: list[float], expected: int) -> list[float]:
    if len(values) != expected or any(not math.isfinite(float(value)) for value in values):
        raise ValueError("reranker returned invalid scores")
    return [float(value) for value in values]
