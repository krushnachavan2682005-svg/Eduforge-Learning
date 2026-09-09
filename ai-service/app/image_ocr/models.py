from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel


BBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class EmbeddedImageOcrCandidate:
    image_id: str
    page_number: int
    image_index: int
    xref: int | None
    pixel_width: int | None
    pixel_height: int | None
    bbox: BBox | None
    page_width: float | None
    page_height: float | None
    is_decorative: bool
    image_metadata: dict[str, Any]
    page_has_ocr: bool = False
    existing_status: str | None = None
    existing_config: dict[str, Any] = field(default_factory=dict)
    existing_text_length: int = 0
    existing_confidence_score: float | None = None
    existing_duplicate_native_text: bool = False
    existing_source_image_fingerprint: str | None = None
    existing_ocr_configuration_fingerprint: str | None = None
    existing_raw_text: str = ""
    existing_ocr_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CandidateDecision:
    candidate: EmbeddedImageOcrCandidate
    selected: bool
    skip_reason: str | None = None


@dataclass(frozen=True)
class AcquiredImage:
    path: str
    strategy: str
    width: int
    height: int
    source_image_fingerprint: str


@dataclass(frozen=True)
class ImageOcrResult:
    image_id: str
    page_number: int
    raw_text: str = ""
    text_length: int = 0
    confidence_score: float | None = None
    ocr_status: str = "FAILED"
    ocr_engine: str = "tesseract"
    ocr_language: str = "eng"
    ocr_config: dict[str, Any] = field(default_factory=dict)
    ocr_metadata: dict[str, Any] = field(default_factory=dict)
    duplicate_native_text: bool = False
    skip_reason: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    source_image_fingerprint: str | None = None
    ocr_configuration_fingerprint: str | None = None


class EmbeddedImageOcrSummary(BaseModel):
    images_detected: int = 0
    candidates_selected: int = 0
    images_processed: int = 0
    images_completed: int = 0
    review_required: int = 0
    no_text_detected: int = 0
    images_skipped: int = 0
    failed: int = 0
    total_text_length: int = 0
    average_confidence: float | None = None
    duplicate_native_text_suppressed: int = 0
    image_text_blocks_created: int = 0
    ocr_engine: str = "tesseract"
    strategy: str = "embedded_image_ocr_v1"
