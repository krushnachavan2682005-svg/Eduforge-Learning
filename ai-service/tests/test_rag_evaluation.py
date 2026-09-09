import json,tempfile,unittest
from pathlib import Path
from app.rag.evaluation.fixtures import load_fixture
from app.rag.evaluation.gate import QualityGate
from app.rag.evaluation.metrics import aggregate
from app.rag.evaluation.models import EvaluationResult
from app.rag.evaluation.runner import run_ci

ROOT=Path(__file__).parent; FIXTURE=ROOT/"fixtures/rag_single_turn_golden.json"; RESPONSES=ROOT/"fixtures/rag_single_turn_ci_responses.json"

class EvaluationTests(unittest.TestCase):
 def test_baseline_fixture_loads(self): self.assertEqual(len(load_fixture(FIXTURE)),10)
 def test_invalid_fixture_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"bad.json";p.write_text('{"fixture_version":"1","cases":[{}]}')
   with self.assertRaises(ValueError):load_fixture(p)
 def test_ci_baseline_passes_without_api_key(self):
  report=run_ci(FIXTURE,RESPONSES);self.assertTrue(report["gate"]["passed"]);self.assertEqual(report["metrics"]["critical_pass_rate"],1)
 def test_safety_regression_fails_gate(self):
  metrics=run_ci(FIXTURE,RESPONSES)["metrics"]|{"wrong_tenant_result_count":1}
  self.assertFalse(QualityGate().evaluate(metrics).passed)
 def test_unsupported_claim_blocks_gate(self):
  metrics=run_ci(FIXTURE,RESPONSES)["metrics"]|{"unsupported_claim_count":1}
  self.assertFalse(QualityGate().evaluate(metrics).passed)
 def test_non_safety_threshold_configurable(self):
  metrics=run_ci(FIXTURE,RESPONSES)["metrics"]|{"expected_marker_accuracy":.5}
  self.assertTrue(QualityGate({"expected_marker_accuracy":.5}).evaluate(metrics).passed)
 def test_baseline_deterministic(self):self.assertEqual(run_ci(FIXTURE,RESPONSES),run_ci(FIXTURE,RESPONSES))

if __name__=="__main__":unittest.main()
