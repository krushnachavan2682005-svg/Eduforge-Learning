from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class StageStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_WARNINGS = "COMPLETED_WITH_WARNINGS"
    SKIPPED = "SKIPPED"
    FAILED_RECOVERABLE = "FAILED_RECOVERABLE"
    FAILED_CRITICAL = "FAILED_CRITICAL"


class ProcessingWarning(BaseModel):
    warning_code: str
    stage: str
    page_number: int | None = None
    source_record_id: str | None = None
    severity: str = "WARNING"
    recoverable: bool = True
    fallback_used: str | None = None
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProcessingFailure(BaseModel):
    error_code: str
    stage: str
    message: str
    recoverable: bool = False
    page_number: int | None = None


class StageDiagnosticResult(BaseModel):
    stage: str
    status: StageStatus
    started_at: Any = None
    completed_at: Any = None
    duration_ms: int | None = None
    input_count: int = 0
    output_count: int = 0
    warning_count: int = 0
    error_code: str | None = None
    safe_error_message: str | None = None
    recoverability: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PageDiagnosticResult(BaseModel):
    page_number: int
    page_exists: bool = False
    route: str | None = None
    text_source_exists: bool = False
    text_length: int = 0
    tables_detected: int = 0
    images_detected: int = 0
    image_ocr_completed: int = 0
    content_blocks_created: int = 0
    content_block_types: list[str] = Field(default_factory=list)
    warnings: list[ProcessingWarning] = Field(default_factory=list)
    failures: list[ProcessingFailure] = Field(default_factory=list)


class LayerCountSummary(BaseModel):
    page_count: int = 0
    page_text_count: int = 0
    table_count: int = 0
    image_count: int = 0
    image_text_count: int = 0
    content_block_count: int = 0
    chunk_count: int = 0


class DocumentDiagnosticReport(BaseModel):
    document: dict[str, Any]
    job: dict[str, Any] | None = None
    terminal_failure_stage: str | None = None
    layers: LayerCountSummary
    stages: list[StageDiagnosticResult]
    pages: list[PageDiagnosticResult]
    warnings: list[ProcessingWarning] = Field(default_factory=list)
    failures: list[ProcessingFailure] = Field(default_factory=list)
