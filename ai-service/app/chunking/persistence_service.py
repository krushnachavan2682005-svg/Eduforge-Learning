import logging
import time

from app.chunking.models import ChunkingSummary, DocumentChunk
from app.chunking.repository import ChunkRepository

logger = logging.getLogger(__name__)


class ChunkPersistenceError(RuntimeError):
    pass


class ChunkPersistenceService:
    def __init__(self, repository: ChunkRepository) -> None:
        self.repository = repository

    def persist(self, *, organization_id: str, document_id: str, chunks: list[DocumentChunk], summary: ChunkingSummary) -> int:
        started = time.monotonic()
        logger.info("CHUNK_PERSISTENCE_START organization_id=%s document_id=%s job_id=%s chunk_count=%s", organization_id, document_id, summary.job_id, len(chunks))
        try:
            count = self.repository.replace(organization_id=organization_id, document_id=document_id, chunks=chunks, summary=summary)
        except Exception as exc:
            logger.exception("CHUNKING_FAILED organization_id=%s document_id=%s job_id=%s chunk_count=%s duration_ms=%s", organization_id, document_id, summary.job_id, len(chunks), round((time.monotonic()-started)*1000))
            raise ChunkPersistenceError("Failed to transactionally replace document chunks") from exc
        logger.info("CHUNKS_PERSISTED organization_id=%s document_id=%s job_id=%s chunk_count=%s total_token_count=%s total_char_count=%s duration_ms=%s", organization_id, document_id, summary.job_id, count, summary.total_chunk_tokens, sum(chunk.char_count for chunk in chunks), round((time.monotonic()-started)*1000))
        logger.info("CHUNKS_PENDING_PROVENANCE_AUDIT organization_id=%s document_id=%s processing_stage=CHUNKING", organization_id, document_id)
        return count

    def persist_no_text(self, *, organization_id: str, document_id: str, summary: ChunkingSummary) -> None:
        self.repository.mark_no_text(organization_id=organization_id, document_id=document_id, summary=summary)
