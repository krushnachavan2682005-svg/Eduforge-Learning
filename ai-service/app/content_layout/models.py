from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field


BBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class LayoutCandidate:
    page_number: int
    block_type: str
    source_type: str
    source_id: str
    extraction_method: str
    bbox: BBox | None = None
    page_width: float | None = None
    page_height: float | None = None
    content_text: str | None = None
    readable_text: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ResolvedContentBlock(LayoutCandidate):
    block_order: int = 0


class ContentLayoutSummary(BaseModel):
    pages_processed: int = 0
    total_blocks: int = 0
    text_blocks: int = 0
    table_blocks: int = 0
    image_blocks: int = 0
    image_text_blocks: int = 0
    ocr_blocks: int = 0
    decorative_images_excluded: int = 0
    duplicate_text_blocks_suppressed: int = 0
    reading_order_strategy: str = "layout_aware_v1"
    warning_count: int = 0
    fallbacks_used: list[str] = Field(default_factory=list)
    page_summaries: list[dict[str, Any]] = Field(default_factory=list)

