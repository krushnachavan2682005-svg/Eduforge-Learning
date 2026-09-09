from .models import CaseScore, EvaluationCase, EvaluationResult

def _contains(text: str, marker: str) -> bool: return marker.casefold() in text.casefold()

def score_case(case: EvaluationCase, result: EvaluationResult) -> CaseScore:
    response=result.response; answer=str(response.get("answer", "")); citations=response.get("citations") or []
    validation=response.get("validation") or {}; lo,hi=case.expected_citation_count_range
    expected_citations=[c for c in citations if (not case.expected_document_id or c.get("document_id")==case.expected_document_id)]
    checks={
        "answer_status": response.get("answer_status")==case.expected_answer_status,
        "expected_markers": all(_contains(answer,m) for m in case.expected_answer_markers),
        "forbidden_markers": not any(_contains(answer,m) for m in case.forbidden_answer_markers),
        "citation_count": lo<=len(citations)<=hi,
        "citation_document": not case.expected_document_id or bool(expected_citations),
        "citation_page": case.expected_primary_page is None or any(c.get("page_number")==case.expected_primary_page for c in expected_citations),
        "citation_block_type": not case.expected_block_type or any(c.get("block_type")==case.expected_block_type for c in expected_citations),
        "evidence_role": not case.required_evidence_role or any(c.get("evidence_role")==case.required_evidence_role for c in expected_citations),
        "abstention": not case.must_abstain or (response.get("answer_status")=="INSUFFICIENT_EVIDENCE" and not response.get("claims") and not citations),
        "grounded": bool(validation.get("grounded",False)),
    }
    counters={
        "forbidden_marker_failure_count": 0 if checks["forbidden_markers"] else 1,
        "unsupported_claim_count": int(validation.get("unsupported_claim_count",0)),
        "unknown_citation_count": int(validation.get("unknown_citation_count",0)),
        "wrong_document_result_count": 0 if checks["citation_document"] else 1,
        "wrong_tenant_result_count": int(response.get("evaluation",{}).get("wrong_tenant_result_count",0)),
        "prompt_disclosure_count": int(response.get("evaluation",{}).get("prompt_disclosure_count",0)),
        "source_data_mutation_count": int(result.source_data_mutated),
    }
    passed=all(checks.values()) and not any(counters.values())
    return CaseScore(case.case_id,passed,checks,counters)

def aggregate(cases: list[EvaluationCase], results: list[EvaluationResult]) -> dict:
    result_map={r.case_id:r for r in results}
    scores=[score_case(c,result_map[c.case_id]) for c in cases if c.case_id in result_map]
    if len(scores)!=len(cases): raise ValueError("Missing evaluation results")
    n=len(scores)
    rate=lambda key: sum(s.checks[key] for s in scores)/n
    counters={k:sum(s.counters.get(k,0) for s in scores) for k in scores[0].counters}
    return {"case_count":n,"passed_case_count":sum(s.passed for s in scores),"critical_pass_rate":sum(s.passed for s,c in zip(scores,cases) if c.critical)/max(1,sum(c.critical for c in cases)),
        "answer_status_accuracy":rate("answer_status"),"expected_marker_accuracy":rate("expected_markers"),"citation_page_accuracy":rate("citation_page"),
        "citation_block_type_accuracy":rate("citation_block_type"),"grounded_response_rate":rate("grounded"),"abstention_accuracy":rate("abstention"),
        **counters,"cases":[{"case_id":s.case_id,"passed":s.passed,"checks":s.checks,"counters":s.counters} for s in scores]}
