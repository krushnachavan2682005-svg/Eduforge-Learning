from dataclasses import dataclass


@dataclass(frozen=True)
class DegradationDecision:
    recoverable: bool
    error_code: str
    fallback: str | None = None


class GracefulDegradationPolicy:
    """Classify known failures explicitly; unknown failures stay critical."""

    RECOVERABLE = {
        "TABLE_EXTRACTION_FAILED": "NATIVE_PAGE_TEXT",
        "IMAGE_EXTRACTION_FAILED": "PRESERVE_IMAGE_METADATA",
        "EMBEDDED_IMAGE_OCR_FAILED": "PRESERVE_IMAGE_WITH_REVIEW_STATUS",
        "LOW_CONFIDENCE_IMAGE_OCR": "IMAGE_OCR_REVIEW_REQUIRED",
        "CONTENT_LAYOUT_FAILED": "SAFE_TOP_TO_BOTTOM_LEFT_TO_RIGHT",
        "MULTI_COLUMN_ORDER_AMBIGUOUS": "LEFT_THEN_RIGHT_COLUMN_ORDER",
        "HEADER_FOOTER_DETECTION_FAILED": "KEEP_SUSPECTED_TEXT",
        "EMPTY_OPTIONAL_BLOCK": "SKIP_INVALID_UNIT",
        "OVERSIZED_BLOCK": "PARAGRAPH_SENTENCE_TOKEN_SPLIT",
        "OVERSIZED_TABLE": "COMPLETE_ROW_SPLIT_REPEAT_HEADER",
    }
    CRITICAL = {
        "ORG_MISMATCH", "DOCUMENT_NOT_FOUND", "PDF_DOWNLOAD_FAILED",
        "INVALID_PDF_FILE", "EXTRACTION_PERSISTENCE_FAILED",
        "CHUNK_PERSISTENCE_FAILED", "DATABASE_UNAVAILABLE",
        "SCHEMA_MISMATCH", "TENANT_ISOLATION_VIOLATION",
    }

    def classify(self, *, error_code: str, stage: str) -> DegradationDecision:
        if error_code in self.RECOVERABLE:
            return DegradationDecision(True, error_code, self.RECOVERABLE[error_code])
        return DegradationDecision(False, error_code)
