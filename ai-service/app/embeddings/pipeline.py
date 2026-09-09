import logging
import time

from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import EmbeddingError, EmbeddingRunSummary, GeneratedEmbedding
from app.embeddings.persistence_service import EmbeddingPersistenceService
from app.embeddings.validator import EmbeddingVectorValidator

logger = logging.getLogger(__name__)


class DocumentEmbeddingPipeline:
    def __init__(self, *, repository, provider, preflight, configuration: EmbeddingConfiguration,
                 batch_size: int, max_batch_tokens: int, max_retries: int,
                 processing_timeout_seconds: int) -> None:
        self.repository = repository
        self.provider = provider
        self.preflight = preflight
        self.configuration = configuration
        self.batch_size = batch_size
        self.max_batch_tokens = max_batch_tokens
        self.max_retries = max_retries
        self.processing_timeout_seconds = processing_timeout_seconds
        self.validator = EmbeddingVectorValidator(
            dimension=configuration.dimension, normalized=configuration.normalize,
        )
        self.persistence = EmbeddingPersistenceService(repository)

    def run(self, *, organization_id: str, document_id: str, job_id: str | None = None,
            force: bool = False, retry_failed: bool = False, batch_size: int | None = None) -> EmbeddingRunSummary:
        started = time.monotonic()
        size = batch_size or self.batch_size
        if size <= 0:
            raise EmbeddingError("EMBEDDING_BATCH_SIZE_INVALID", "Batch size must be positive")
        logger.info("EMBEDDING_PIPELINE_START organization_id=%s document_id=%s job_id=%s batch_size=%s embedding_model=%s embedding_model_revision=%s embedding_dimension=%s embedding_configuration_fingerprint=%s", organization_id, document_id, job_id, size, self.configuration.model, self.configuration.model_revision, self.configuration.dimension, self.configuration.fingerprint)
        preflight = self.preflight.run(check_model=True)
        if not preflight.passed:
            logger.error("EMBEDDING_PIPELINE_FAILED organization_id=%s document_id=%s job_id=%s error_code=%s", organization_id, document_id, job_id, preflight.blocking_reason)
            raise EmbeddingError(preflight.blocking_reason or "EMBEDDING_PREFLIGHT_FAILED", "Embedding environment preflight failed")
        plan = self.repository.inspect_plan(
            organization_id=organization_id, document_id=document_id, configuration=self.configuration,
        )
        chunks = self.repository.claim_chunks(
            organization_id=organization_id, document_id=document_id,
            configuration=self.configuration, force=force, retry_failed=retry_failed,
            timeout_seconds=self.processing_timeout_seconds,
            job_id=job_id,
        )
        summary = EmbeddingRunSummary(
            organization_id=organization_id, document_id=document_id,
            provider=self.configuration.provider, model=self.configuration.model,
            model_revision=self.configuration.model_revision, dimension=self.configuration.dimension,
            configuration_fingerprint=self.configuration.fingerprint,
            total_chunks=plan["total_chunks"], already_valid=plan["already_valid"], selected=len(chunks),
        )
        logger.info("EMBEDDING_CHUNKS_SELECTED organization_id=%s document_id=%s job_id=%s chunk_count=%s", organization_id, document_id, job_id, len(chunks))
        for batch_number, batch in enumerate(self._batches(chunks, size), start=1):
            logger.info("EMBEDDING_BATCH_START organization_id=%s document_id=%s job_id=%s batch_number=%s batch_size=%s chunk_count=%s", organization_id, document_id, job_id, batch_number, size, len(batch))
            error: EmbeddingError | None = None
            for attempt in range(1, self.max_retries + 1):
                batch_started = time.monotonic()
                try:
                    vectors = self.provider.embed_documents([chunk.content for chunk in batch])
                    logger.info("EMBEDDING_BATCH_GENERATED organization_id=%s document_id=%s job_id=%s batch_number=%s generated_count=%s", organization_id, document_id, job_id, batch_number, len(vectors))
                    validated = self.validator.validate_batch(vectors, expected_count=len(batch))
                    logger.info("EMBEDDING_BATCH_VALIDATED organization_id=%s document_id=%s job_id=%s batch_number=%s generated_count=%s", organization_id, document_id, job_id, batch_number, len(validated))
                    generated = [GeneratedEmbedding(
                        chunk=chunk, vector=vector,
                        generation_duration_ms=round((time.monotonic() - batch_started) * 1000),
                        attempt=chunk.retry_count + attempt,
                    ) for chunk, vector in zip(batch, validated)]
                    count = self.persistence.persist_batch(
                        organization_id=organization_id, document_id=document_id,
                        configuration=self.configuration, embeddings=generated,
                    )
                    summary.generated += count
                    logger.info("EMBEDDING_BATCH_PERSISTED organization_id=%s document_id=%s job_id=%s batch_number=%s generated_count=%s", organization_id, document_id, job_id, batch_number, count)
                    error = None
                    break
                except EmbeddingError as exc:
                    error = exc
                    if not exc.retryable or attempt == self.max_retries:
                        break
                except Exception:
                    error = EmbeddingError("EMBEDDING_PROVIDER_ERROR", "Embedding batch failed", True)
                    if attempt == self.max_retries:
                        break
            if error:
                if error.error_code in {
                    "EMBEDDING_PERSISTENCE_FAILED", "PGVECTOR_PYTHON_ADAPTER_NOT_INSTALLED",
                    "EMBEDDING_CLAIM_LOST",
                }:
                    self.repository.restore_claims(
                        organization_id=organization_id, document_id=document_id,
                        configuration=self.configuration, chunks=batch,
                    )
                    if job_id:
                        self.repository.mark_job_failed(
                            organization_id=organization_id, document_id=document_id,
                            job_id=job_id, error_code=error.error_code, message=error.message,
                        )
                    logger.error("EMBEDDING_PIPELINE_FAILED organization_id=%s document_id=%s job_id=%s error_code=%s", organization_id, document_id, job_id, error.error_code)
                    raise error
                self.repository.mark_failed(
                    organization_id=organization_id, document_id=document_id, chunks=batch,
                    error_code=error.error_code, message=error.message,
                )
                summary.failed += len(batch)
                logger.error("EMBEDDING_CHUNK_FAILED organization_id=%s document_id=%s job_id=%s batch_number=%s failed_count=%s error_code=%s", organization_id, document_id, job_id, batch_number, len(batch), error.error_code)
        summary.duration_ms = round((time.monotonic() - started) * 1000)
        summary.outcome = "COMPLETED" if summary.failed == 0 else "PARTIAL_FAILED"
        completeness = self.repository.finalize(
            organization_id=organization_id, document_id=document_id,
            configuration=self.configuration, summary=summary.to_dict(), job_id=job_id,
        )
        logger.info("EMBEDDING_COMPLETENESS_CHECK organization_id=%s document_id=%s job_id=%s chunk_count=%s generated_count=%s failed_count=%s complete=%s", organization_id, document_id, job_id, completeness["total"], summary.generated, summary.failed, completeness["complete"])
        if not completeness["complete"]:
            summary.outcome = "PARTIAL_FAILED" if summary.failed else "INCOMPLETE"
        logger.info("EMBEDDING_PIPELINE_DONE organization_id=%s document_id=%s job_id=%s chunk_count=%s generated_count=%s failed_count=%s duration_ms=%s", organization_id, document_id, job_id, summary.total_chunks, summary.generated, summary.failed, summary.duration_ms)
        return summary

    def _batches(self, chunks, size: int):
        batch = []
        token_count = 0
        for chunk in chunks:
            if batch and (len(batch) >= size or token_count + chunk.token_count > self.max_batch_tokens):
                yield batch
                batch = []
                token_count = 0
            batch.append(chunk)
            token_count += chunk.token_count
        if batch:
            yield batch
