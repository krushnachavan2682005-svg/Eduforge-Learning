from typing import Any

from pydantic import BaseModel, Field


class TextPageResult(BaseModel):
    page_number: int
    text: str = ""
    text_length: int = 0
    layout_blocks: list[dict[str, Any]] = Field(default_factory=list)
    page_width: float | None = None
    page_height: float | None = None


class ImagePageResult(BaseModel):
    page_number: int
    image_count: int = 0
    image_refs: list[dict[str, Any]] = Field(default_factory=list)
    visual_content_detected: bool = False
    error: str | None = None
    page_width: float | None = None
    page_height: float | None = None


class TablePageResult(BaseModel):
    page_number: int
    table_count: int = 0
    tables: list[Any] = Field(default_factory=list)
    extraction_method: str = "pdfplumber"
    unavailable: bool = False
    error: str | None = None
    table_bboxes: list[tuple[float, float, float, float] | None] = Field(default_factory=list)
    page_width: float | None = None
    page_height: float | None = None


class NormalizedExtractionResult(BaseModel):
    document_id: str
    job_id: str
    document_type: str
    page_count: int
    total_text_length: int
    total_table_count: int
    total_image_count: int
    ocr_required: bool
    pages_requiring_ocr: list[int]
    next_stage: str
    routes: list[dict[str, Any]]
    extraction_summary: dict[str, int]

