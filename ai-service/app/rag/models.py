from dataclasses import dataclass
from typing import Any

class RagError(RuntimeError):
    def __init__(self, code: str, message: str, status_code: int = 400, retryable: bool = False,
                 retrieval_diagnostics: dict[str, Any] | None = None):
        super().__init__(message); self.error_code=code; self.message=message
        self.status_code=status_code; self.retryable=retryable
        self.retrieval_diagnostics=retrieval_diagnostics

@dataclass(frozen=True)
class RagRequest:
    organization_id: str; question: str; document_ids: list[str]; top_k: int
    minimum_similarity: float; include_evidence: bool = True

@dataclass
class RagContextItem:
    label: str; citation_id: str; evidence_id: str; document_id: str; document_title: str
    chunk_id: int; chunk_index: int; page_number: int; source_pages: list[int]
    block_type: str; evidence_role: str; citation_precision: str; provenance_confidence: float
    source_record_type: str; source_record_id: str|None; content_block_id: str; content_fingerprint: str
    section_title: str|None; text: str; token_count: int; similarity_score: float
    context_priority: float; metadata: dict[str,Any]
