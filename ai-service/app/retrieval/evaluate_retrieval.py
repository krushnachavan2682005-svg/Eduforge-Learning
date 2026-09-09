import argparse
import json
import sys
from pathlib import Path
from statistics import mean

from app.config.settings import get_settings
from app.retrieval.factory import get_retrieval_components


def evaluate(organization_id: str, cases: list[dict]) -> dict:
    settings = get_settings()
    validator, service, _, _ = get_retrieval_components(settings)
    ranks, latencies, wrong_documents, wrong_pages, no_results = [], [], 0, 0, 0
    case_results = []
    for case in cases:
        request = validator.validate(organization_id=organization_id, query=case["query"],
            document_id=case.get("document_id"), top_k=case.get("top_k", 5),
            minimum_similarity=case.get("minimum_similarity", -1.0), include_content=True)
        response = service.search(request, correlation_id="retrieval-evaluation")
        latencies.append(response["duration_ms"])
        expected_marker = case.get("expected_text_marker", "").casefold()
        expected_pages = set(case.get("expected_pages", []))
        expected_document = case.get("expected_document_id")
        rank = next((r["rank"] for r in response["results"] if
            (not expected_document or r["document_id"] == expected_document) and
            (not expected_marker or expected_marker in (r["content"] or "").casefold()) and
            (not expected_pages or expected_pages.intersection(r["source_pages"]))), None)
        if rank is None:
            no_results += 1
        else:
            ranks.append(rank)
        wrong_documents += sum(1 for r in response["results"] if expected_document and r["document_id"] != expected_document)
        wrong_pages += sum(1 for r in response["results"] if expected_marker in (r["content"] or "").casefold() and expected_pages and not expected_pages.intersection(r["source_pages"]))
        case_results.append({"query": case["query"], "relevant_rank": rank, "results": response["results"], "duration_ms": response["duration_ms"]})
    total = len(cases) or 1
    return {"recall_at_1": sum(r <= 1 for r in ranks) / total, "recall_at_3": sum(r <= 3 for r in ranks) / total,
            "recall_at_5": sum(r <= 5 for r in ranks) / total, "mrr": sum(1 / r for r in ranks) / total,
            "no_result_count": no_results, "wrong_document_result_count": wrong_documents,
            "wrong_page_result_count": wrong_pages, "average_latency_ms": mean(latencies) if latencies else 0,
            "cases": case_results}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--output-file")
    args = parser.parse_args()
    report = evaluate(args.organization_id, json.loads(Path(args.dataset).read_text(encoding="utf-8")))
    output = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output_file:
        Path(args.output_file).write_text(output, encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
