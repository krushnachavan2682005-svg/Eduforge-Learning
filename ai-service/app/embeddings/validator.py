import math
from collections.abc import Sequence

from app.embeddings.models import EmbeddingError


class EmbeddingVectorValidator:
    def __init__(self, *, dimension: int, normalized: bool, norm_tolerance: float = 1e-3) -> None:
        self.dimension = dimension
        self.normalized = normalized
        self.norm_tolerance = norm_tolerance

    def validate_batch(self, vectors: Sequence[Sequence[float]], *, expected_count: int) -> list[list[float]]:
        if vectors is None or len(vectors) != expected_count:
            raise EmbeddingError(
                "EMBEDDING_OUTPUT_COUNT_MISMATCH",
                f"Expected {expected_count} vectors but received {0 if vectors is None else len(vectors)}",
            )
        return [self.validate_vector(vector) for vector in vectors]

    def validate_vector(self, vector: Sequence[float]) -> list[float]:
        if vector is None or isinstance(vector, (str, bytes)):
            raise EmbeddingError("EMBEDDING_VECTOR_INVALID", "Embedding must be a numeric sequence")
        values = list(vector)
        if len(values) != self.dimension:
            raise EmbeddingError(
                "EMBEDDING_DIMENSION_MISMATCH",
                f"Expected dimension {self.dimension} but received {len(values)}",
            )
        if any(isinstance(value, (list, tuple, dict)) or not isinstance(value, (int, float)) for value in values):
            raise EmbeddingError("EMBEDDING_VECTOR_INVALID", "Embedding must be one-dimensional and numeric")
        converted = [float(value) for value in values]
        if not all(math.isfinite(value) for value in converted):
            raise EmbeddingError("EMBEDDING_NON_FINITE_VALUE", "Embedding contains NaN or infinity")
        norm = math.sqrt(sum(value * value for value in converted))
        if norm == 0:
            raise EmbeddingError("EMBEDDING_ZERO_VECTOR", "Embedding is an all-zero vector")
        if self.normalized and abs(norm - 1.0) > self.norm_tolerance:
            raise EmbeddingError(
                "EMBEDDING_NORMALIZATION_FAILED", f"Normalized embedding L2 norm was {norm:.6f}"
            )
        return converted
