from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import GeneratedEmbedding


class EmbeddingPersistenceService:
    def __init__(self, repository) -> None:
        self.repository = repository

    def persist_batch(self, *, organization_id: str, document_id: str,
                      configuration: EmbeddingConfiguration,
                      embeddings: list[GeneratedEmbedding]) -> int:
        try:
            return self.repository.persist_batch(
                organization_id=organization_id,
                document_id=document_id,
                configuration=configuration,
                embeddings=embeddings,
            )
        except Exception as exc:
            from app.embeddings.models import EmbeddingError
            if isinstance(exc, EmbeddingError):
                raise
            raise EmbeddingError(
                "EMBEDDING_PERSISTENCE_FAILED",
                "Embedding batch persistence failed and was rolled back",
            ) from exc
