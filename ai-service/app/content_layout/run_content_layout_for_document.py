import argparse
import sys

from app.config.settings import get_settings
from app.content_layout.content_layout_service import ContentLayoutService
from app.content_layout.repository import ContentBlockRepository


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild ordered content blocks for an existing document")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    args = parser.parse_args()
    try:
        settings = get_settings()
        summary = ContentLayoutService(ContentBlockRepository(settings.database_url)).process(
            organization_id=args.organization_id, document_id=args.document_id,
        )
    except Exception as exc:
        print(f"Content layout failed: {exc}", file=sys.stderr)
        return 1

    print(f"Document: {args.document_id}")
    for page in summary.page_summaries:
        print(f"Page {page['page_number']}: blocks={page['persisted_count']} suppressed={page['suppressed_count']}")
    print(f"Pages processed: {summary.pages_processed}")
    print(f"Total blocks: {summary.total_blocks}")
    print(f"Text blocks: {summary.text_blocks}")
    print(f"Table blocks: {summary.table_blocks}")
    print(f"Image blocks: {summary.image_blocks}")
    print(f"OCR blocks: {summary.ocr_blocks}")
    print(f"Duplicates suppressed: {summary.duplicate_text_blocks_suppressed}")
    print("Status: CONTENT_BLOCKS_READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
