import json
from pathlib import Path
from .models import EvaluationCase

def load_fixture(path: str | Path) -> list[EvaluationCase]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or set(raw) != {"fixture_version", "cases"}: raise ValueError("Fixture root must contain only fixture_version and cases")
    if not isinstance(raw["cases"], list) or not raw["cases"]: raise ValueError("Fixture cases must be a non-empty list")
    cases = [EvaluationCase.from_dict({**case, "fixture_version": case.get("fixture_version", raw["fixture_version"])}) for case in raw["cases"]]
    ids = [case.case_id for case in cases]
    if len(ids) != len(set(ids)): raise ValueError("Duplicate case_id")
    return cases
