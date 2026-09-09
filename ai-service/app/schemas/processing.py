from typing import Literal

from pydantic import BaseModel, Field


DocumentType = Literal["DIGITAL_PDF", "SCANNED_PDF", "MIXED_PDF", "UNKNOWN"]
NextStage = Literal[
    "OCR_REQUIRED",
    "TEXT_EXTRACTION_READY",
    "TABLE_EXTRACTION_READY",
    "IMAGE_EXTRACTION_READY",
    "CHUNKING_READY",
]
PageRoute = Literal[
    "PAGE_TEXT_ONLY",
    "PAGE_TABLE_ONLY",
    "PAGE_IMAGE_ONLY",
    "PAGE_TEXT_TABLE",
    "PAGE_TEXT_IMAGE",
    "PAGE_TABLE_IMAGE",
    "PAGE_TEXT_TABLE_IMAGE",
    "PAGE_SCANNED_IMAGE",
    "PAGE_EMPTY_OR_UNREADABLE",
]


class PageAnalysis(BaseModel):
    page_number: int
    text_length: int = 0
    has_text: bool = False
    has_tables: bool = False
    table_count: int = 0
    has_images: bool = False
    image_count: int = 0
    needs_ocr: bool = False
    extraction_tools_required: list[str] = Field(default_factory=list)
    route: PageRoute = "PAGE_EMPTY_OR_UNREADABLE"
    errors: list[dict[str, str]] = Field(default_factory=list)


class ExtractionSummary(BaseModel):
    text_pages: int = 0
    table_pages: int = 0
    image_pages: int = 0
    scanned_pages: int = 0


class DocumentRouteResult(BaseModel):
    document_type: DocumentType
    next_stage: NextStage
    ocr_required: bool
    pages_requiring_ocr: list[int]
    extraction_summary: ExtractionSummary

