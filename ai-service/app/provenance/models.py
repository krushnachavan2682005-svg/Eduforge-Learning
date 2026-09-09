from typing import Any

from pydantic import BaseModel, Field


class ProvenanceIssue(BaseModel):
    error_code: str
    message: str
    page_number: int | None = None
    image_id: str | None = None
    image_text_id: str | None = None
    content_block_id: str | None = None
    chunk_index: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProvenanceAuditReport(BaseModel):
    organization_id: str
    document_id: str
    page_count: int = 0
    image_count: int = 0
    image_text_count: int = 0
    image_block_count: int = 0
    image_text_block_count: int = 0
    chunk_count: int = 0
    valid_image_text_relationships: int = 0
    issues: list[ProvenanceIssue] = Field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.issues

    def issue_count(self, code: str) -> int:
        return sum(issue.error_code == code for issue in self.issues)


class ProvenanceIntegrityError(RuntimeError):
    def __init__(self, report: ProvenanceAuditReport) -> None:
        self.report = report
        super().__init__(f"Provenance audit failed with {len(report.issues)} issue(s)")
