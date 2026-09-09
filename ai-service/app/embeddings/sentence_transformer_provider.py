import logging
import math
import time
import threading
import uuid
from typing import Any

from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import EmbeddingError
from app.embeddings.provider import EmbeddingProvider

logger = logging.getLogger(__name__)


class SentenceTransformerEmbeddingProvider(EmbeddingProvider):
    def __init__(self, configuration: EmbeddingConfiguration) -> None:
        self.configuration = configuration
        self._model: Any | None = None
        self._load_lock = threading.Lock()
        self.provider_instance_id = str(uuid.uuid4())
        self.model_load_count = 0
        self.query_embedding_count = 0

    @property
    def model_name(self) -> str:
        return self.configuration.model

    @property
    def model_version(self) -> str:
        return self.configuration.model_revision

    @property
    def embedding_dimension(self) -> int:
        return self.configuration.dimension

    @property
    def configuration_fingerprint(self) -> str:
        return self.configuration.fingerprint

    @property
    def normalize_embeddings(self) -> bool:
        return self.configuration.normalize

    def load_model(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            self._load_model_once()

    def _load_model_once(self) -> None:
        started = time.monotonic()
        logger.info(
            "EMBEDDING_MODEL_LOAD_START embedding_model=%s embedding_model_revision=%s embedding_dimension=%s",
            self.model_name, self.model_version, self.embedding_dimension,
        )
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise EmbeddingError(
                "EMBEDDING_DEPENDENCY_NOT_INSTALLED",
                "sentence-transformers is not installed; install requirements before model preflight",
            ) from exc
        try:
            self._model = SentenceTransformer(
                self.model_name, revision=self.model_version, device=self.configuration.device,
            )
            actual_dimension = int(self._model.get_sentence_embedding_dimension())
            if actual_dimension != self.embedding_dimension:
                self._model = None
                raise EmbeddingError(
                    "EMBEDDING_DIMENSION_MISMATCH",
                    f"Configured dimension {self.embedding_dimension} differs from model dimension {actual_dimension}",
                )
        except EmbeddingError:
            raise
        except Exception as exc:
            raise EmbeddingError("EMBEDDING_MODEL_LOAD_FAILED", "Embedding model could not be loaded") from exc
        logger.info(
            "EMBEDDING_MODEL_LOAD_DONE embedding_model=%s embedding_model_revision=%s embedding_dimension=%s duration_ms=%s",
            self.model_name, self.model_version, self.embedding_dimension,
            round((time.monotonic() - started) * 1000),
        )
        self.model_load_count += 1

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.load_model()
        prepared = [self.configuration.document_prefix + text for text in texts]
        return self._encode_documents(prepared)

    def embed_query(self, text: str) -> list[float]:
        self.load_model()
        self.query_embedding_count += 1
        return self._encode_documents([self.configuration.query_prefix + text])[0]

    def runtime_info(self) -> dict[str, Any]:
        return {"provider_initialized": True, "provider_instance_id": self.provider_instance_id,
                "model_loaded": self._model is not None, "model_load_count": self.model_load_count,
                "query_embedding_count": self.query_embedding_count, "model": self.model_name,
                "model_revision": self.model_version, "configuration_fingerprint": self.configuration_fingerprint}

    def _encode_documents(self, prepared: list[str]) -> list[list[float]]:
        windows: list[str] = []
        owners: list[int] = []
        tokenizer = self._model.tokenizer
        for owner, text in enumerate(prepared):
            token_ids = tokenizer(
                text, add_special_tokens=False, truncation=False, verbose=False,
            )["input_ids"]
            if not token_ids:
                token_ids = tokenizer(
                    ".", add_special_tokens=False, truncation=False, verbose=False,
                )["input_ids"]
            for offset in range(0, len(token_ids), self.configuration.window_tokens):
                windows.append(tokenizer.decode(token_ids[offset:offset + self.configuration.window_tokens]))
                owners.append(owner)
        try:
            values = self._model.encode(
                windows,
                batch_size=len(windows) or 1,
                normalize_embeddings=False,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
            totals = [[0.0] * self.embedding_dimension for _ in prepared]
            counts = [0] * len(prepared)
            for owner, vector in zip(owners, values):
                counts[owner] += 1
                for index, value in enumerate(vector):
                    totals[owner][index] += float(value)
            results = []
            for total, count in zip(totals, counts):
                averaged = [value / count for value in total]
                if self.normalize_embeddings:
                    norm = math.sqrt(sum(value * value for value in averaged))
                    if norm == 0:
                        raise EmbeddingError("EMBEDDING_ZERO_VECTOR", "Window-pooled embedding was zero")
                    averaged = [value / norm for value in averaged]
                results.append(averaged)
            return results
        except Exception as exc:
            if isinstance(exc, EmbeddingError):
                raise
            raise EmbeddingError("EMBEDDING_PROVIDER_ERROR", "Document embedding generation failed", True) from exc
