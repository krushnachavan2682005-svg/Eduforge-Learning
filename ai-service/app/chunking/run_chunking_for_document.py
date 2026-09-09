import argparse
import json
import logging

from app.chunking.pipeline import ChunkingPipeline
from app.config.settings import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Build retrieval-ready chunks from canonical content blocks")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--show-summary", action="store_true")
    parser.add_argument("--force", action="store_true", help="Rebuild even when chunks already exist (rebuilds are idempotent by default)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    chunks, summary = ChunkingPipeline.from_settings(get_settings()).run(
        organization_id=args.organization_id, document_id=args.document_id, dry_run=args.dry_run,
    )
    output = summary.to_dict()
    output["dry_run"] = args.dry_run
    output["chunk_token_counts"] = [chunk.token_count for chunk in chunks]
    output["page_ranges"] = [[chunk.page_start, chunk.page_end] for chunk in chunks]
    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
