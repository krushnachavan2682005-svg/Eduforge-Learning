from dataclasses import dataclass, field, replace
from typing import Any


STRATEGY = "structure_aware_page_context_v1"
CLEANING_VERSION = "conservative_nfkc_v1"


@dataclass(frozen=True)
class SemanticUnit:
    content_block_id: str
    page_number: int
    block_order: int
    block_type: str
    source_type: str
    source_record_id: str
    text: str
    bbox: tuple[float, float, float, float] | None = None
    page_height: float | None = None
    table_id: str | None = None
    image_id: str | None = None
    image_text_id: str | None = None
    confidence_score: float | None = None
    review_status: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    section_title: str | None = None
    content_type: str = "PARAGRAPH"
    is_heading: bool = False
    excluded_reason: str | None = None

    def evolve(self, **changes: Any) -> "SemanticUnit":
        return replace(self, **changes)


@dataclass(frozen=True)
class ChunkConfig:
    target_tokens: int = 800
    max_tokens: int = 1000
    min_tokens: int = 150
    overlap_tokens: int = 120

    def validate(self) -> None:
        if not (0 <= self.overlap_tokens < self.target_tokens <= self.max_tokens):
            raise ValueError("Chunk token settings must satisfy overlap < target <= max")
        if self.min_tokens < 0 or self.min_tokens > self.target_tokens:
            raise ValueError("CHUNK_MIN_TOKENS must be between zero and target")


@dataclass(frozen=True)
class HeaderFooterConfig:
    min_pages: int = 3
    occurrence_ratio: float = 0.60
    header_band_ratio: float = 0.12
    footer_band_ratio: float = 0.12
    similarity: float = 0.92


@dataclass
class DocumentChunk:
    chunk_index: int
    content: str
    page_start: int
    page_end: int
    source_pages: list[int]
    section_title: str | None
    content_types: list[str]
    source_block_ids: list[str]
    token_count: int
    char_count: int
    tokenizer_name: str
    chunking_strategy: str
    content_fingerprint: str
    metadata: dict[str, Any]
    embedding_status: str = "PENDING"


@dataclass
class ChunkingSummary:
    source_blocks_loaded: int
    source_pages: int
    headers_removed: int
    footers_removed: int
    semantic_units_created: int
    chunks_created: int
    total_cleaned_characters: int
    total_chunk_tokens: int
    table_chunks: int
    image_text_chunks: int
    ocr_chunks: int
    low_confidence_sources: int
    tokenizer: str
    target_tokens: int
    max_tokens: int
    overlap_tokens: int
    strategy: str = STRATEGY
    chunking_version: str = "v1"
    job_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return dict(self.__dict__)
