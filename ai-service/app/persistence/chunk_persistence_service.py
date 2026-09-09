from app.database.repositories import DocumentProcessingRepository
from app.schemas.chunking import ChunkingSummary, DocumentChunk


class ChunkPersistenceError(Exception):
    pass


class ChunkPersistenceService:
    def __init__(self, repository: DocumentProcessingRepository) -> None:
        self.repository = repository

    def persist(
        self,
        *,
        organization_id: str,
        document_id: str,
        chunks: list[DocumentChunk],
    ) -> ChunkingSummary:
        try:
            return self.repository.persist_document_chunks(
                organization_id=organization_id,
                document_id=document_id,
                chunks=chunks,
            )
        except Exception as exc:
            raise ChunkPersistenceError("Failed to persist document chunks") from exc
