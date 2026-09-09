import argparse
import json

from app.config.settings import get_settings
from app.embeddings.factory import build_embedding_components
from app.embeddings.models import EmbeddingError


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate versioned pgvector embeddings for canonical chunks")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--batch-size", type=int)
    parser.add_argument("--show-summary", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    configuration, repository, _, preflight, pipeline = build_embedding_components(settings)
    if args.dry_run:
        environment = preflight.run(check_model=False)
        plan = repository.inspect_plan(
            organization_id=args.organization_id, document_id=args.document_id,
            configuration=configuration,
        )
        payload = {
            "document": args.document_id,
            "active_model": configuration.model,
            "model_revision": configuration.model_revision,
            "dimension": configuration.dimension,
            "configuration_fingerprint": configuration.fingerprint,
            **plan,
            "pgvector_readiness": "PASS" if environment.passed else "FAIL",
            "blocking_reason": environment.blocking_reason,
            "planned_actions": "claim pending/stale chunks, batch embed, validate, persist, completeness check",
        }
        print(json.dumps(payload, indent=2, default=str) if args.json else "\n".join(f"{k}: {v}" for k, v in payload.items()))
        return 0 if environment.passed else 1
    try:
        summary = pipeline.run(
            organization_id=args.organization_id, document_id=args.document_id,
            force=args.force, retry_failed=args.retry_failed, batch_size=args.batch_size,
        )
    except EmbeddingError as exc:
        print(json.dumps({"outcome": "FAILED", "error_code": exc.error_code, "message": exc.message}, indent=2) if args.json else f"Embedding failed: {exc.error_code}: {exc.message}")
        return 1
    payload = summary.to_dict()
    print(json.dumps(payload, indent=2, default=str) if args.json else "\n".join(f"{k}: {v}" for k, v in payload.items()))
    return 0 if summary.outcome == "COMPLETED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
