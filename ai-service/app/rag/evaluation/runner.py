import json
from pathlib import Path
from .fixtures import load_fixture
from .gate import QualityGate
from .metrics import aggregate
from .models import EvaluationResult

def run_ci(fixture_path: str|Path, response_path: str|Path, thresholds=None):
    cases=load_fixture(fixture_path)
    raw=json.loads(Path(response_path).read_text(encoding="utf-8"))
    results=[EvaluationResult(item["case_id"],item["response"],item.get("source_data_mutated",False)) for item in raw["results"]]
    metrics=aggregate(cases,results); gate=QualityGate(thresholds).evaluate(metrics)
    return {"mode":"ci","metrics":metrics,"gate":{"passed":gate.passed,"failures":list(gate.failures)}}
