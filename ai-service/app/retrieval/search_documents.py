import argparse
import json
from pathlib import Path

from app.config.settings import get_settings
from app.retrieval.factory import get_retrieval_components


def main() -> None:
    parser = argparse.ArgumentParser(description="Tenant-safe exact semantic retrieval")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--document-id")
    parser.add_argument("--top-k", type=int)
    parser.add_argument("--minimum-similarity", type=float)
    parser.add_argument("--search-mode", choices=["exact"], default="exact")
    parser.add_argument("--show-content", action="store_true")
    parser.add_argument("--show-metadata", action="store_true")
    parser.add_argument("--show-evidence", action="store_true")
    parser.add_argument("--explain", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--output-file")
    args = parser.parse_args()
    settings = get_settings()
    validator, service, repository, configuration = get_retrieval_components(settings)
    request = validator.validate(organization_id=args.organization_id, query=args.query,
        document_id=args.document_id, top_k=args.top_k, minimum_similarity=args.minimum_similarity,
        include_content=args.show_content)
    response = service.search(request, correlation_id="retrieval-cli")
    if not args.show_metadata:
        for result in response["results"]:
            result.pop("metadata", None)
    if not args.show_evidence:
        for result in response["results"]:
            result.pop("evidence", None)
    if args.explain:
        with service._model_lock:
            vector = service.validator.validate_vector(service.provider.embed_query(request.query))
        response["explain"] = repository.explain_exact(organization_id=request.organization_id,
            query_vector=vector, configuration=configuration, top_k=request.top_k,
            minimum_similarity=request.minimum_similarity, document_ids=request.document_ids)
    output = json.dumps(response, indent=2, ensure_ascii=False, default=str)
    if args.output_file:
        Path(args.output_file).write_text(output, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
