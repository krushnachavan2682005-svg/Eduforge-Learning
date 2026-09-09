import logging
from datetime import datetime
from typing import Any

from app.diagnostics.models import (DocumentDiagnosticReport, LayerCountSummary,
    PageDiagnosticResult, ProcessingFailure, ProcessingWarning, StageDiagnosticResult, StageStatus)
from app.diagnostics.policy import GracefulDegradationPolicy
from app.diagnostics.repository import DiagnosticsRepository

logger = logging.getLogger(__name__)
STAGES = ["DOWNLOAD","PDF_ANALYSIS","SOURCE_EXTRACTION","SOURCE_PERSISTENCE","FULL_PAGE_OCR","EMBEDDED_IMAGE_OCR","CONTENT_LAYOUT","TEXT_CLEANING","SEMANTIC_UNIT_BUILDING","CHUNK_ASSEMBLY","CHUNK_VALIDATION","CHUNK_PERSISTENCE","STAGE_UPDATE"]
ERROR_STAGE = {"PDF_DOWNLOAD_FAILED":"DOWNLOAD","INVALID_PDF_FILE":"PDF_ANALYSIS","PDF_TEXT_EXTRACTION_FAILED":"SOURCE_EXTRACTION","EXTRACTION_PERSISTENCE_FAILED":"SOURCE_PERSISTENCE","OCR_PIPELINE_FAILED":"FULL_PAGE_OCR","OCR_PERSISTENCE_FAILED":"FULL_PAGE_OCR","EMBEDDED_IMAGE_OCR_PERSISTENCE_FAILED":"EMBEDDED_IMAGE_OCR","CONTENT_LAYOUT_PERSISTENCE_FAILED":"CONTENT_LAYOUT","TEXT_CLEANING_FAILED":"TEXT_CLEANING","DOCUMENT_CHUNKING_FAILED":"CHUNK_ASSEMBLY"}


class DocumentProcessingDiagnosticsService:
    def __init__(self, repository: DiagnosticsRepository) -> None:
        self.repository = repository
        self.policy = GracefulDegradationPolicy()

    def diagnose(self, *, organization_id: str, document_id: str) -> DocumentDiagnosticReport:
        started = datetime.now()
        logger.info("PROCESSING_DIAGNOSTIC_START organization_id=%s document_id=%s", organization_id, document_id)
        data = self.repository.load(organization_id, document_id)
        job, counts = data["job"] or {}, data["counts"]
        warnings: list[ProcessingWarning] = []
        pages: list[PageDiagnosticResult] = []
        for row in data["pages"]:
            page_warnings = []
            if "REVIEW_REQUIRED" in row["image_ocr_statuses"]:
                page_warnings.append(ProcessingWarning(warning_code="IMAGE_OCR_REVIEW_REQUIRED",stage="EMBEDDED_IMAGE_OCR",page_number=row["page_number"],fallback_used="PRESERVE_RAW_OCR_WITH_REVIEW_STATUS",message="Embedded image OCR requires review."))
            if "FAILED" in row["image_ocr_statuses"]:
                page_warnings.append(ProcessingWarning(warning_code="IMAGE_OCR_FAILED_RECOVERED",stage="EMBEDDED_IMAGE_OCR",page_number=row["page_number"],fallback_used="PRESERVE_IMAGE_METADATA",message="Embedded image OCR failed; image evidence was preserved."))
            warnings.extend(page_warnings)
            pages.append(PageDiagnosticResult(page_number=row["page_number"],page_exists=True,route=row["route"],text_source_exists=row["text_length"]>0,text_length=row["text_length"],tables_detected=row["tables_detected"],images_detected=row["images_detected"],image_ocr_completed=row["image_ocr_completed"],content_blocks_created=row["content_blocks_created"],content_block_types=list(row["content_block_types"]),warnings=page_warnings))
            logger.info("PROCESSING_DIAGNOSTIC_PAGE_RESULT organization_id=%s document_id=%s page_number=%s warning_count=%s", organization_id, document_id, row["page_number"], len(page_warnings))
        error_code = job.get("error_code") if job.get("status") == "FAILED" else None
        terminal = ERROR_STAGE.get(error_code) if error_code else None
        failures = []
        if error_code:
            decision = self.policy.classify(error_code=error_code, stage=terminal or "UNKNOWN")
            failures.append(ProcessingFailure(error_code=error_code,stage=terminal or "UNKNOWN",message=job.get("error_message") or "Processing failed",recoverable=decision.recoverable))
        completed = {"DOWNLOAD": bool(data["document"].get("storage_key")),"PDF_ANALYSIS":counts["page_count"]>0,"SOURCE_EXTRACTION":counts["page_count"]>0,"SOURCE_PERSISTENCE":counts["page_count"]>0,"FULL_PAGE_OCR":True,"EMBEDDED_IMAGE_OCR":counts["image_count"]==0 or counts["image_text_count"]>0,"CONTENT_LAYOUT":counts["content_block_count"]>0,"TEXT_CLEANING":counts["chunk_count"]>0,"SEMANTIC_UNIT_BUILDING":counts["chunk_count"]>0,"CHUNK_ASSEMBLY":counts["chunk_count"]>0,"CHUNK_VALIDATION":counts["chunk_count"]>0,"CHUNK_PERSISTENCE":counts["chunk_count"]>0,"STAGE_UPDATE":data["document"].get("processing_stage") == "EMBEDDING_READY"}
        stages=[]
        for stage in STAGES:
            stage_warnings=sum(w.stage==stage for w in warnings)
            if terminal==stage: status=StageStatus.FAILED_CRITICAL
            elif stage=="FULL_PAGE_OCR" and not (job.get("result_metadata") or {}).get("ocr_required"): status=StageStatus.SKIPPED
            elif completed[stage]: status=StageStatus.COMPLETED_WITH_WARNINGS if stage_warnings else StageStatus.COMPLETED
            else: status=StageStatus.NOT_STARTED
            stages.append(StageDiagnosticResult(stage=stage,status=status,warning_count=stage_warnings,error_code=error_code if terminal==stage else None,safe_error_message=job.get("error_message") if terminal==stage else None))
            logger.info("PROCESSING_DIAGNOSTIC_STAGE_RESULT organization_id=%s document_id=%s stage=%s status=%s warning_count=%s", organization_id, document_id, stage, status.value, stage_warnings)
        logger.info("PROCESSING_DIAGNOSTIC_DONE organization_id=%s document_id=%s duration_ms=%s",organization_id,document_id,round((datetime.now()-started).total_seconds()*1000))
        return DocumentDiagnosticReport(document=data["document"],job=job or None,terminal_failure_stage=terminal,layers=LayerCountSummary(**counts),stages=stages,pages=pages,warnings=warnings,failures=failures)
