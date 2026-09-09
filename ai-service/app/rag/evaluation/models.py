from dataclasses import dataclass, field
from typing import Any

ALLOWED_STATUSES = {"ANSWERED", "PARTIALLY_ANSWERED", "INSUFFICIENT_EVIDENCE", "CONFLICTING_EVIDENCE", "REFUSED_UNSAFE"}

@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    fixture_version: str
    question: str
    expected_answer_status: str
    expected_answer_markers: tuple[str, ...] = ()
    forbidden_answer_markers: tuple[str, ...] = ()
    expected_document_id: str | None = None
    expected_primary_page: int | None = None
    expected_block_type: str | None = None
    required_evidence_role: str | None = None
    expected_citation_count_range: tuple[int, int] = (0, 99)
    must_abstain: bool = False
    security_category: str | None = None
    critical: bool = True
    previous_turns: tuple[dict[str, Any], ...] = ()
    conversation_summary: dict[str, Any] | None = None
    document_ids: tuple[str, ...] = ()
    notes: str = ""

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "EvaluationCase":
        required = {"case_id", "fixture_version", "question", "expected_answer_status"}
        missing = required - value.keys()
        if missing: raise ValueError(f"Missing fixture fields: {sorted(missing)}")
        if value["expected_answer_status"] not in ALLOWED_STATUSES: raise ValueError("Invalid expected answer status")
        bounds = value.get("expected_citation_count_range", [0, 99])
        if len(bounds) != 2 or bounds[0] < 0 or bounds[1] < bounds[0]: raise ValueError("Invalid citation count range")
        known = set(cls.__dataclass_fields__)
        unknown = set(value) - known
        if unknown: raise ValueError(f"Unknown fixture fields: {sorted(unknown)}")
        converted = dict(value)
        for key in ("expected_answer_markers", "forbidden_answer_markers", "previous_turns", "document_ids"):
            converted[key] = tuple(converted.get(key, ()))
        converted["expected_citation_count_range"] = tuple(bounds)
        return cls(**converted)

@dataclass(frozen=True)
class EvaluationResult:
    case_id: str
    response: dict[str, Any]
    source_data_mutated: bool = False

@dataclass
class CaseScore:
    case_id: str
    passed: bool
    checks: dict[str, bool]
    counters: dict[str, int] = field(default_factory=dict)
