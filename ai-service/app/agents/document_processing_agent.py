import logging
from typing import Any

from fastapi import HTTPException, status

from app.agents.document_router import DocumentRouter
from app.agents.tool_registry import ToolRegistry
from app.chunking.pipeline import ChunkingPipeline, DocumentChunkingError, TextCleaningError
from app.config.settings import Settings
from app.content_layout.content_layout_service import ContentLayoutService
from app.content_layout.persistence_service import ContentBlockPersistenceError
from app.content_layout.repository import ContentBlockRepository
from app.database.repositories import DocumentProcessingRepository, OCRSchemaNotReadyError, RepositoryError
from app.errors import error_body
from app.extractors.text_extractor import PdfTextExtractionError
from app.image_ocr.repository import ImageTextRepository
from app.image_ocr.service import EmbeddedImageOcrPersistenceError, EmbeddedImageOcrService
from app.ocr.ocr_pipeline import OCRPipeline, OCRPipelineError
from app.ocr.tesseract_engine import OCREngineNotAvailableError
from app.parsers.pymupdf_parser import InvalidPdfFileError
from app.persistence.extraction_persistence_service import ExtractionPersistenceError, ExtractionPersistenceService
from app.persistence.ocr_persistence_service import OCRPersistenceError, OCRPersistenceService
from app.provenance.audit_service import ProvenanceAuditService
from app.provenance.image_ocr_provenance_guard import ImageOcrProvenanceGuard
from app.provenance.models import ProvenanceIntegrityError
from app.provenance.repository import ProvenanceRepository
from app.storage.object_storage import ObjectStorage, PdfDownloadFailedError, StorageObjectNotFoundError
from app.storage.temp_files import cleanup_temp_file, write_temp_pdf

logger = logging.getLogger(__name__)


class DocumentProcessingAgent:
    def __init__(self, settings: Settings, repository: DocumentProcessingRepository) -> None:
        self.settings = settings
        self.repository = repository
        self.storage = ObjectStorage(settings)
        self.tool_registry = ToolRegistry()
        self.router = DocumentRouter()
        self.persistence_service = ExtractionPersistenceService(repository)
        self.ocr_pipeline = OCRPipeline(settings)
        self.ocr_persistence_service = OCRPersistenceService(repository)
        self.chunking_pipeline = ChunkingPipeline.from_settings(settings)
        self.content_layout_service = ContentLayoutService(ContentBlockRepository(settings.database_url))
        self.embedded_image_ocr_service = EmbeddedImageOcrService(
            settings, ImageTextRepository(settings.database_url),
        )
        self.provenance_audit = ProvenanceAuditService(ProvenanceRepository(settings.database_url))
        self.image_provenance_guard = ImageOcrProvenanceGuard(self.provenance_audit)

    def process_job(self, payload: dict[str, Any], request_id: str) -> dict[str, Any]:
        temp_path: str | None = None
        document_id = payload["document_id"]
        job_id = payload["job_id"]
        organization_id = payload["organization_id"]

        logger.info("Starting content analysis request_id=%s document_id=%s job_id=%s", request_id, document_id, job_id)

        try:
            self.repository.prepare_job(job_id=job_id, document_id=document_id, organization_id=organization_id)

            storage_bucket = payload.get("storage_bucket") or self.settings.supabase_bucket
            pdf_bytes = self.storage.download_pdf(storage_bucket, payload["storage_key"])
            temp_path = write_temp_pdf(pdf_bytes, self.settings.ai_service_temp_dir)

            try:
                text_pages = self.tool_registry.get("pymupdf_text_extractor")(temp_path)
                image_pages = self.tool_registry.get("pymupdf_image_detector")(temp_path)
                table_pages = self.tool_registry.get("pdfplumber_table_extractor")(temp_path)
            except Exception as exc:
                logger.exception("EXTRACTION_CRASHED document_id=%s error=%s", document_id, exc)
                raise PdfTextExtractionError(f"Malformed or unreadable PDF document: {exc}") from exc

            result = self.router.route(
                document_id=document_id,
                job_id=job_id,
                text_pages=text_pages,
                table_pages=table_pages,
                image_pages=image_pages,
            )

            persistence_summary = self.persistence_service.persist(
                job_id=job_id,
                organization_id=organization_id,
                document_id=document_id,
                extraction_result=result,
                text_pages=text_pages,
                table_pages=table_pages,
                image_pages=image_pages,
            )
            logger.warning("AGENT_STAGE extraction_persisted document_id=%s", document_id)
            processing_stage = _decide_processing_stage(
                document_type=result.document_type,
                total_text_length=result.total_text_length,
                ocr_required=result.ocr_required,
            )
            logger.warning(
                "OCR decision request_id=%s document_id=%s job_id=%s document_type=%s processing_stage_before_ocr=%s ocr_required=%s pages_requiring_ocr=%s",
                request_id,
                document_id,
                job_id,
                result.document_type,
                processing_stage,
                result.ocr_required,
                result.pages_requiring_ocr,
            )
            ocr_summary: dict[str, Any] | None = None
            ocr_text_length = 0
            logger.warning("OCR_DB_CHECK organization_id=%s document_id=%s", organization_id, document_id)
            ocr_pages = self.repository.get_ocr_required_pages(organization_id, document_id)
            logger.warning("OCR_REQUIRED_PAGES count=%s pages=%s", len(ocr_pages), ocr_pages)
            if ocr_pages:
                logger.warning("OCR_PIPELINE_START document_id=%s pages=%s", document_id, ocr_pages)
                raw_ocr_summary = self.ocr_pipeline.run(
                    organization_id=organization_id,
                    document_id=document_id,
                    pdf_path=temp_path,
                    pages=ocr_pages,
                    request_id=request_id,
                )
                logger.warning(
                    "OCR_PIPELINE_DONE pages_processed=%s pages_succeeded=%s total_text_length=%s",
                    raw_ocr_summary.pages_processed,
                    raw_ocr_summary.pages_succeeded,
                    raw_ocr_summary.total_ocr_text_length,
                )
                rows_saved = self.ocr_persistence_service.persist(
                    job_id=job_id,
                    organization_id=organization_id,
                    document_id=document_id,
                    ocr_summary=raw_ocr_summary,
                    min_text_length=self.settings.ocr_min_text_length,
                )
                logger.warning("OCR_PERSISTENCE_DONE rows_saved=%s", rows_saved)
                ocr_summary = raw_ocr_summary.lightweight()
                ocr_text_length = raw_ocr_summary.total_ocr_text_length
                processing_stage = _decide_post_ocr_stage(raw_ocr_summary)
                logger.info(
                    "OCR persisted request_id=%s document_id=%s job_id=%s pages_processed=%s pages_succeeded=%s total_text_length=%s next_stage=%s",
                    request_id,
                    document_id,
                    job_id,
                    raw_ocr_summary.pages_processed,
                    raw_ocr_summary.pages_succeeded,
                    raw_ocr_summary.total_ocr_text_length,
                    processing_stage,
                )
            else:
                logger.warning("OCR_SKIPPED reason=NO_OCR_REQUIRED_PAGES")

            embedded_image_ocr_summary = self.embedded_image_ocr_service.process(
                organization_id=organization_id,
                document_id=document_id,
                pdf_path=temp_path,
            )
            self.image_provenance_guard.validate(
                organization_id=organization_id, document_id=document_id,
            )
            pre_layout_stage = processing_stage
            content_layout_summary = self.content_layout_service.process(
                job_id=job_id,
                organization_id=organization_id,
                document_id=document_id,
            )
            logger.info(
                "EMBEDDED_IMAGE_LAYOUT_UPDATED organization_id=%s document_id=%s image_text_blocks_created=%s",
                organization_id, document_id, content_layout_summary.image_text_blocks,
            )
            processing_stage = (
                pre_layout_stage
                if pre_layout_stage in {"OCR_REQUIRED", "OCR_PARTIAL", "OCR_REVIEW_REQUIRED"}
                else "CONTENT_BLOCKS_READY"
            )

            chunking_summary: dict[str, Any] | None = None
            chunking_skipped_reason: str | None = None
            provenance_audit_summary: dict[str, Any] | None = None

            if processing_stage in {"OCR_REQUIRED", "OCR_PARTIAL", "OCR_REVIEW_REQUIRED"}:
                chunking_skipped_reason = "OCR_REQUIRED"
            elif payload.get("processing_type") == "PREPROCESS_PDF":
                chunking_skipped_reason = "PREPROCESS_ONLY"
            else:
                try:
                    chunks, chunk_summary = self.chunking_pipeline.run(
                        organization_id=organization_id, document_id=document_id, job_id=job_id,
                    )
                except Exception as exc:
                    logger.exception("CHUNKING_CRASHED document_id=%s error=%s", document_id, exc)
                    if isinstance(exc, (TextCleaningError, DocumentChunkingError)):
                        raise
                    raise DocumentChunkingError(f"Chunking process failed unexpectedly: {exc}") from exc
                if chunks:
                    chunking_summary = chunk_summary.to_dict()
                    processing_stage = "EMBEDDING_READY"
                else:
                    chunking_skipped_reason = "NO_CHUNKS_CREATED"
                    chunking_summary = chunk_summary.to_dict()
                    processing_stage = "NO_TEXT_AVAILABLE"

            if processing_stage == "EMBEDDING_READY":
                provenance_report = self.provenance_audit.audit(
                    organization_id=organization_id, document_id=document_id,
                )
                if not provenance_report.passed:
                    raise ProvenanceIntegrityError(provenance_report)
                provenance_audit_summary = {
                    "outcome": "PASS",
                    "image_count": provenance_report.image_count,
                    "image_text_count": provenance_report.image_text_count,
                    "chunk_count": provenance_report.chunk_count,
                    "issue_count": 0,
                }

            result_metadata = _build_lightweight_result_metadata(
                result=result,
                persistence_summary=persistence_summary.model_dump(),
                ocr_summary=ocr_summary,
                chunking_summary=chunking_summary,
                chunking_skipped_reason=chunking_skipped_reason,
                table_extraction_unavailable=any(page.unavailable for page in table_pages),
                final_next_stage=processing_stage,
                content_layout_summary=content_layout_summary.model_dump(exclude={"page_summaries"}),
                embedded_image_ocr_summary=embedded_image_ocr_summary.model_dump(),
            )
            if provenance_audit_summary:
                result_metadata["provenance_audit"] = provenance_audit_summary
            self.repository.mark_content_analysis_success(
                job_id=job_id,
                document_id=document_id,
                organization_id=organization_id,
                page_count=result.page_count,
                text_extracted=(result.total_text_length + ocr_text_length) > 0,
                document_type=result.document_type,
                processing_stage=processing_stage,
                result_metadata=result_metadata,
            )
            if result_metadata["processing_quality"]["warning_count"]:
                logger.warning(
                    "PROCESSING_COMPLETED_WITH_WARNINGS organization_id=%s document_id=%s job_id=%s warning_count=%s fallbacks=%s",
                    organization_id, document_id, job_id,
                    result_metadata["processing_quality"]["warning_count"],
                    result_metadata["processing_quality"]["fallbacks_used"],
                )
            logger.info("Completed content analysis request_id=%s document_id=%s job_id=%s", request_id, document_id, job_id)
            return result_metadata
        except RepositoryError as exc:
            if exc.error_code != "JOB_ALREADY_RUNNING":
                self._mark_failed(payload, exc.error_code, exc.message)
            raise self._http_error(
                status_code=status.HTTP_409_CONFLICT if exc.error_code == "JOB_ALREADY_RUNNING" else status.HTTP_404_NOT_FOUND,
                error_code=exc.error_code,
                message=exc.message,
                payload=payload,
                request_id=request_id,
                retryable=exc.retryable,
            ) from exc
        except StorageObjectNotFoundError as exc:
            self._mark_failed(payload, "PDF_DOWNLOAD_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_404_NOT_FOUND,
                error_code="PDF_DOWNLOAD_FAILED",
                message="Failed to download PDF from storage",
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except PdfDownloadFailedError as exc:
            self._mark_failed(payload, "PDF_DOWNLOAD_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="PDF_DOWNLOAD_FAILED",
                message="Failed to download PDF from storage",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except InvalidPdfFileError as exc:
            self._mark_failed(payload, "INVALID_PDF_FILE", str(exc))
            raise self._http_error(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_code="INVALID_PDF_FILE",
                message="Invalid PDF file",
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except PdfTextExtractionError as exc:
            self._mark_failed(payload, "PDF_TEXT_EXTRACTION_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="PDF_TEXT_EXTRACTION_FAILED",
                message="PDF text extraction failed",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except ExtractionPersistenceError as exc:
            self._mark_failed(payload, "EXTRACTION_PERSISTENCE_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="EXTRACTION_PERSISTENCE_FAILED",
                message="Failed to persist extracted document content",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except OCREngineNotAvailableError as exc:
            self._mark_failed(payload, "OCR_ENGINE_NOT_AVAILABLE", str(exc), processing_stage="OCR_REQUIRED")
            raise self._http_error(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                error_code="OCR_ENGINE_NOT_AVAILABLE",
                message="Tesseract OCR engine is not installed or not configured.",
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except OCRPipelineError as exc:
            self._mark_failed(payload, "OCR_PIPELINE_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="OCR_PIPELINE_FAILED",
                message="OCR pipeline failed",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except OCRPersistenceError as exc:
            self._mark_failed(payload, "OCR_PERSISTENCE_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="OCR_PERSISTENCE_FAILED",
                message="Failed to persist OCR results",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except OCRSchemaNotReadyError as exc:
            self._mark_failed(payload, "OCR_SCHEMA_NOT_READY", str(exc), processing_stage="OCR_REQUIRED")
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="OCR_SCHEMA_NOT_READY",
                message=str(exc),
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except ContentBlockPersistenceError as exc:
            self._mark_failed(payload, "CONTENT_LAYOUT_PERSISTENCE_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="CONTENT_LAYOUT_PERSISTENCE_FAILED",
                message="Failed to persist ordered document content",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except EmbeddedImageOcrPersistenceError as exc:
            self._mark_failed(payload, "EMBEDDED_IMAGE_OCR_PERSISTENCE_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="EMBEDDED_IMAGE_OCR_PERSISTENCE_FAILED",
                message="Failed to persist embedded-image OCR results",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except TextCleaningError as exc:
            self._mark_failed(payload, "TEXT_CLEANING_FAILED", str(exc), processing_stage="CHUNKING_FAILED")
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="TEXT_CLEANING_FAILED",
                message="Failed to clean extracted text",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except DocumentChunkingError as exc:
            self._mark_failed(payload, "DOCUMENT_CHUNKING_FAILED", str(exc), processing_stage="CHUNKING_FAILED")
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="DOCUMENT_CHUNKING_FAILED",
                message="Failed to create page-aware chunks",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except ProvenanceIntegrityError as exc:
            self._mark_failed(payload, "CONTENT_INTEGRITY_FAILED", str(exc), processing_stage="CONTENT_INTEGRITY_FAILED")
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="CONTENT_INTEGRITY_FAILED",
                message=str(exc),
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except OSError as exc:
            self._mark_failed(payload, "TEMP_FILE_CREATE_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="TEMP_FILE_CREATE_FAILED",
                message="Failed to create temporary PDF file",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except Exception as exc:
            self._mark_failed(payload, "PDF_CONTENT_ANALYSIS_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="PDF_CONTENT_ANALYSIS_FAILED",
                message=str(exc) or "PDF content analysis failed",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        finally:
            cleanup_temp_file(temp_path)

    def _mark_failed(
        self,
        payload: dict[str, Any],
        error_code: str,
        message: str,
        processing_stage: str = "FAILED",
    ) -> None:
        try:
            self.repository.mark_failed(
                job_id=payload["job_id"],
                document_id=payload["document_id"],
                organization_id=payload["organization_id"],
                error_code=error_code,
                error_message=message,
                processing_stage=processing_stage,
            )
        except Exception as exc:
            raise RuntimeError("JOB_UPDATE_FAILED") from exc

    def _http_error(
        self,
        *,
        status_code: int,
        error_code: str,
        message: str,
        payload: dict[str, Any],
        request_id: str,
        retryable: bool,
    ) -> HTTPException:
        return HTTPException(
            status_code=status_code,
            detail=error_body(
                error_code=error_code,
                message=message,
                details={
                    "document_id": payload["document_id"],
                    "organization_id": payload["organization_id"],
                    "storage_bucket": payload["storage_bucket"],
                    "storage_key": payload["storage_key"],
                    **(
                        {"hint": "Install Tesseract and set TESSERACT_CMD in ai-service/.env"}
                        if error_code == "OCR_ENGINE_NOT_AVAILABLE"
                        else {}
                    ),
                },
                request_id=request_id,
                retryable=retryable,
            ),
        )


def _decide_processing_stage(*, document_type: str, total_text_length: int, ocr_required: bool) -> str:
    if ocr_required and document_type == "SCANNED_PDF":
        return "OCR_REQUIRED"
    if total_text_length > 0:
        return "CHUNKING_READY"
    if ocr_required:
        return "OCR_REQUIRED"
    return "EXTRACTION_PERSISTED"


def _decide_post_ocr_stage(ocr_summary: Any) -> str:
    if ocr_summary.pages_processed == 0:
        return "OCR_REQUIRED"
    if ocr_summary.pages_succeeded > 0 and ocr_summary.pages_failed == 0 and not ocr_summary.low_confidence_pages:
        return "CHUNKING_READY"
    if ocr_summary.pages_succeeded > 0:
        return "OCR_PARTIAL"
    if ocr_summary.low_confidence_pages:
        return "OCR_REVIEW_REQUIRED"
    return "OCR_REQUIRED"


def _build_lightweight_result_metadata(
    *,
    result: Any,
    persistence_summary: dict[str, int],
    ocr_summary: dict[str, Any] | None,
    chunking_summary: dict[str, Any] | None,
    chunking_skipped_reason: str | None,
    table_extraction_unavailable: bool,
    final_next_stage: str,
    content_layout_summary: dict[str, Any],
    embedded_image_ocr_summary: dict[str, Any],
) -> dict[str, Any]:
    metadata = {
        "document_type": result.document_type,
        "page_count": result.page_count,
        "total_text_length": result.total_text_length,
        "total_table_count": result.total_table_count,
        "total_image_count": result.total_image_count,
        "ocr_required": result.ocr_required,
        "pages_requiring_ocr": result.pages_requiring_ocr,
        "next_stage": final_next_stage,
        "extraction_summary": result.extraction_summary,
        "persistence": persistence_summary,
        "content_layout": content_layout_summary,
        "embedded_image_ocr": embedded_image_ocr_summary,
    }
    if ocr_summary:
        metadata["ocr"] = ocr_summary
    if chunking_summary:
        metadata["chunking"] = chunking_summary
    if chunking_skipped_reason:
        metadata["chunking_skipped_reason"] = chunking_skipped_reason
    if table_extraction_unavailable:
        metadata["table_extraction"] = {
            "available": False,
            "message": "pdfplumber is not installed or table extraction is unavailable",
        }
    warning_count = (
        int(embedded_image_ocr_summary.get("review_required", 0))
        + int(embedded_image_ocr_summary.get("failed", 0))
        + int(content_layout_summary.get("warning_count", 0))
        + int(table_extraction_unavailable)
    )
    fallbacks: list[str] = []
    if embedded_image_ocr_summary.get("review_required"):
        fallbacks.append("IMAGE_OCR_REVIEW_REQUIRED")
    if embedded_image_ocr_summary.get("failed"):
        fallbacks.append("PRESERVE_IMAGE_METADATA")
    if table_extraction_unavailable:
        fallbacks.append("NATIVE_PAGE_TEXT")
    fallbacks.extend(content_layout_summary.get("fallbacks_used", []))
    metadata["processing_quality"] = {
        "outcome": "COMPLETED_WITH_WARNINGS" if warning_count else "COMPLETED",
        "warning_count": warning_count,
        "critical_failure_count": 0,
        "fallbacks_used": list(dict.fromkeys(fallbacks)),
    }
    return metadata
