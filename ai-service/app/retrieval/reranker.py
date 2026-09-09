import threading
import time
from typing import Any

from app.retrieval.hybrid import validate_scores


class CrossEncoderReranker:
    def __init__(self, model_name: str, revision: str, batch_size: int = 8):
        self.model_name, self.revision, self.batch_size = model_name, revision, batch_size
        self._model = None; self._load_lock = threading.Lock(); self._inference_lock = threading.Lock()
        self.model_load_count = 0; self.cold_load_ms = None

    def load_model(self):
        if self._model is None:
            with self._load_lock:
                if self._model is None:
                    from sentence_transformers import CrossEncoder
                    started = time.monotonic()
                    self._model = CrossEncoder(self.model_name, revision=self.revision)
                    self.cold_load_ms = round((time.monotonic() - started) * 1000)
                    self.model_load_count += 1
        return self._model

    def rerank(self, query: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        model = self.load_model()
        pairs = [(query, row.get("content") or "") for row in rows]
        with self._inference_lock:
            scores = validate_scores(list(model.predict(pairs, batch_size=self.batch_size, show_progress_bar=False)), len(rows))
        ranked = []
        for row, score in zip(rows, scores):
            item = dict(row); item["reranker_score"] = score; ranked.append(item)
        ranked.sort(key=lambda row: (-row["reranker_score"], row.get("fusion_rank", 10**9), str(row["document_id"]), int(row["chunk_index"]), int(row["chunk_id"])))
        for rank, row in enumerate(ranked, 1): row["reranker_rank"] = rank
        return ranked

    def runtime_info(self):
        return {"reranker_model": self.model_name, "reranker_revision": self.revision,
                "reranker_loaded": self._model is not None, "reranker_model_load_count": self.model_load_count,
                "reranker_cold_load_ms": self.cold_load_ms, "reranker_batch_size": self.batch_size}
