from typing import Any

from pydantic import BaseModel, Field


class DocumentPageRow(BaseModel):
    organization_id: str
    document_id: str
    page_number: int
    route: str
    has_text: bool
    has_tables: bool
    has_images: bool
    needs_ocr: bool
    text_length: int
    table_count: int
    image_count: int
    page_width: float | None = None
    page_height: float | None = None


class DocumentPageTextRow(BaseModel):
    organization_id: str
    document_id: str
    page_number: int
    text: str
    text_length: int
    extraction_method: str = "pymupdf"
    layout_blocks: list[dict[str, Any]] = Field(default_factory=list)
    page_width: float | None = None
    page_height: float | None = None


class DocumentTableRow(BaseModel):
    organization_id: str
    document_id: str
    page_number: int
    table_index: int
    table_data: list[Any]
    row_count: int | None = None
    column_count: int | None = None
    extraction_method: str = "pdfplumber"
    extraction_error: str | None = None
    bbox: tuple[float, float, float, float] | None = None
    page_width: float | None = None
    page_height: float | None = None


class DocumentImageRow(BaseModel):
    organization_id: str
    document_id: str
    page_number: int
    image_index: int
    image_metadata: dict[str, Any]
    extraction_method: str = "pymupdf"
    extraction_error: str | None = None
    bbox: tuple[float, float, float, float] | None = None
    page_width: float | None = None
    page_height: float | None = None
    is_decorative: bool = False


class ExtractionPersistenceRows(BaseModel):
    pages: list[DocumentPageRow] = Field(default_factory=list)
    page_texts: list[DocumentPageTextRow] = Field(default_factory=list)
    tables: list[DocumentTableRow] = Field(default_factory=list)
    images: list[DocumentImageRow] = Field(default_factory=list)


class ExtractionPersistenceSummary(BaseModel):
    document_pages_saved: int
    page_texts_saved: int
    tables_saved: int
    images_saved: int

