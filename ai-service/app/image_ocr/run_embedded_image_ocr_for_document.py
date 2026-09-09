import argparse
import logging
import sys

from app.config.settings import get_settings
from app.content_layout.content_layout_service import ContentLayoutService
from app.content_layout.repository import ContentBlockRepository
from app.image_ocr.repository import ImageTextRepository
from app.image_ocr.service import EmbeddedImageOcrService
from app.storage.object_storage import ObjectStorage
from app.storage.temp_files import cleanup_temp_file, write_temp_pdf

logger = logging.getLogger(__name__)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    parser = argparse.ArgumentParser(description="Run embedded-image OCR for an existing document")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    args = parser.parse_args()
    temp_path: str | None = None
    try:
        settings = get_settings()
        image_repository = ImageTextRepository(settings.database_url)
        context = image_repository.load_context(
            organization_id=args.organization_id, document_id=args.document_id,
        )
        document = context["document"]
        pdf_bytes = ObjectStorage(settings).download_pdf(
            document["storage_bucket"], document["storage_key"],
        )
        temp_path = write_temp_pdf(pdf_bytes, settings.ai_service_temp_dir)
        summary = EmbeddedImageOcrService(settings, image_repository).process(
            organization_id=args.organization_id, document_id=args.document_id, pdf_path=temp_path,
        )
        layout = ContentLayoutService(ContentBlockRepository(settings.database_url)).process(
            organization_id=args.organization_id, document_id=args.document_id,
        )
        logger.info(
            "EMBEDDED_IMAGE_LAYOUT_UPDATED organization_id=%s document_id=%s image_text_blocks_created=%s",
            args.organization_id, args.document_id, layout.image_text_blocks,
        )
    except Exception as exc:
        print(f"Embedded image OCR failed: {exc}", file=sys.stderr)
        return 1
    finally:
        cleanup_temp_file(temp_path)

    print(f"Document: {args.document_id}")
    print(f"Images detected: {summary.images_detected}")
    print(f"Candidates selected: {summary.candidates_selected}")
    print(f"Images processed: {summary.images_processed}")
    print(f"Completed: {summary.images_completed}")
    print(f"Review required: {summary.review_required}")
    print(f"No text detected: {summary.no_text_detected}")
    print(f"Skipped: {summary.images_skipped}")
    print(f"Failed: {summary.failed}")
    print(f"IMAGE_TEXT blocks created: {layout.image_text_blocks}")
    print("Status: CONTENT_BLOCKS_READY")
    return 1 if summary.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
