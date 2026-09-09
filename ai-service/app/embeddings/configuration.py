import hashlib
import importlib.metadata
import json
from dataclasses import dataclass
from typing import Any

from app.config.settings import Settings


@dataclass(frozen=True)
class EmbeddingConfiguration:
    provider: str
    model: str
    model_revision: str
    dimension: int
    normalize: bool
    device: str = "cpu"
    document_prefix: str = ""
    query_prefix: str = ""
    pooling: str = "mean_of_token_windows_v1"
    window_tokens: int = 510
    implementation_version: str = "document_chunk_embeddings_v1"
    library_version: str = "unknown"

    @classmethod
    def from_settings(cls, settings: Settings) -> "EmbeddingConfiguration":
        try:
            library_version = importlib.metadata.version("sentence-transformers")
        except importlib.metadata.PackageNotFoundError:
            library_version = "not-installed"
        return cls(
            provider=settings.embedding_provider,
            model=settings.embedding_model,
            model_revision=settings.embedding_model_revision,
            dimension=settings.embedding_dimension,
            normalize=settings.embedding_normalize,
            device=settings.embedding_device,
            document_prefix=settings.embedding_document_prefix,
            query_prefix=settings.embedding_query_prefix,
            window_tokens=settings.embedding_window_tokens,
            library_version=library_version,
        )

    def fingerprint_payload(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "model_revision": self.model_revision,
            "dimension": self.dimension,
            "normalize": self.normalize,
            "pooling": self.pooling,
            "window_tokens": self.window_tokens,
            "library_version": self.library_version,
            "document_prefix": self.document_prefix,
            "query_prefix": self.query_prefix,
            "implementation_version": self.implementation_version,
        }

    @property
    def fingerprint(self) -> str:
        payload = json.dumps(
            self.fingerprint_payload(), sort_keys=True, ensure_ascii=False, separators=(",", ":")
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
