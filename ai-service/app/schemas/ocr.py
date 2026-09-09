from pydantic import BaseModel, Field


class OCRPageResult(BaseModel):
    page_number: int
    text: str = ""
    text_length: int = 0
    confidence_score: float | None = None
    status: str = "FAILED"
    error: str | None = None


class OCRSummary(BaseModel):
    ocr_engine: str = "tesseract"
    language: str = "eng"
    tesseract_available: bool = True
    pages_requested: int = 0
    pages_processed: int = 0
    pages_succeeded: int = 0
    pages_failed: int = 0
    total_ocr_text_length: int = 0
    average_confidence: float | None = None
    low_confidence_pages: list[int] = Field(default_factory=list)
    failed_pages: list[dict] = Field(default_factory=list)
    results: list[OCRPageResult] = Field(default_factory=list)

    def lightweight(self) -> dict:
        return {
            "engine": self.ocr_engine,
            "language": self.language,
            "tesseract_available": self.tesseract_available,
            "pages_requested": self.pages_requested,
            "pages_processed": self.pages_processed,
            "pages_succeeded": self.pages_succeeded,
            "pages_failed": self.pages_failed,
            "total_ocr_text_length": self.total_ocr_text_length,
            "average_confidence": self.average_confidence,
            "low_confidence_pages": self.low_confidence_pages,
            "failed_pages": self.failed_pages,
        }
