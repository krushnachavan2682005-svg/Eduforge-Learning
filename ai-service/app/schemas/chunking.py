from math import ceil
from typing import Any

from pydantic import BaseModel, Field


class PageTextForChunking(BaseModel):
    page_number: int
    text: str
    text_length: int
    has_tables: bool = False
    has_images: bool = False
    table_count: int = 0
    image_count: int = 0


class DocumentChunk(BaseModel):
    chunk_index: int
    chunk_text: str
    cleaned_text: str
    page_start: int
    page_end: int
    section_title: str | None = None
    token_count: int
    char_count: int
    chunk_type: str = "TEXT"
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding_status: str = "PENDING"


class ChunkingSummary(BaseModel):
    chunks_saved: int
    total_token_count: int
    total_char_count: int
    strategy: str = "page_aware_v1"
    cleaning_version: str = "v1"


def approximate_token_count(text: str) -> int:
    return max(1, ceil(len(text) / 4))
