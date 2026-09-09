from dataclasses import dataclass, field
from typing import Any


class EmbeddingError(RuntimeError):
    def __init__(self, error_code: str, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message
        self.retryable = retryable


@dataclass(frozen=True)
class EmbeddingChunk:
    id: int
    chunk_index: int
    content: str
    content_fingerprint: str
    source_pages: list[int]
    token_count: int
    claim_token: str | None = None
    retry_count: int = 0


@dataclass(frozen=True)
class GeneratedEmbedding:
    chunk: EmbeddingChunk
    vector: list[float]
    generation_duration_ms: int
    attempt: int


@dataclass
class PreflightCheck:
    name: str
    status: str
    error_code: str | None = None
    message: str | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class EmbeddingPreflightResult:
    checks: list[PreflightCheck] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not any(check.status == "FAIL" for check in self.checks)

    @property
    def blocking_reason(self) -> str | None:
        failed = next((check for check in self.checks if check.status == "FAIL"), None)
        return failed.error_code if failed else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "checks": [check.__dict__ for check in self.checks],
            "overall_result": "PASS" if self.passed else "FAIL",
            "blocking_reason": self.blocking_reason,
        }


@dataclass
class EmbeddingRunSummary:
    organization_id: str
    document_id: str
    provider: str
    model: str
    model_revision: str
    dimension: int
    configuration_fingerprint: str
    total_chunks: int = 0
    already_valid: int = 0
    selected: int = 0
    generated: int = 0
    failed: int = 0
    duration_ms: int = 0
    outcome: str = "PENDING"

    def to_dict(self) -> dict[str, Any]:
        return dict(self.__dict__)
