import argparse
from pathlib import Path

from app.config.settings import get_settings
from app.database.repositories import DocumentProcessingRepository
from app.ocr.ocr_pipeline import OCRPipeline
from app.ocr.tesseract_engine import _load_pytesseract
from app.persistence.ocr_persistence_service import OCRPersistenceService
from app.storage.object_storage import ObjectStorage
from app.storage.temp_files import cleanup_temp_file, write_temp_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description="Run OCR for an existing document with needs_ocr pages.")
    parser.add_argument("--organization-id", required=True)
    parser.add_argument("--document-id", required=True)
    args = parser.parse_args()

    settings = get_settings()
    repository = DocumentProcessingRepository(settings.database_url)
    storage = ObjectStorage(settings)
    pipeline = OCRPipeline(settings)
    persistence = OCRPersistenceService(repository)
    temp_pdf_path: str | None = None

    _load_pytesseract(settings)
    repository.assert_ocr_schema_ready()

    debug = repository.debug_document_ocr_state(args.organization_id, args.document_id)
    print(f"debug={debug}")

    ocr_pages = repository.get_ocr_required_pages(args.organization_id, args.document_id)
    print(f"pages_found={len(ocr_pages)} pages={ocr_pages}")
    if not ocr_pages:
        print("No OCR-required pages found.")
        return

    location = repository.get_document_storage_location(
        organization_id=args.organization_id,
        document_id=args.document_id,
    )
    pdf_bytes = storage.download_pdf(location["storage_bucket"], location["storage_key"])

    try:
        temp_pdf_path = write_temp_pdf(pdf_bytes, settings.ai_service_temp_dir)
        summary = pipeline.run(
            organization_id=args.organization_id,
            document_id=args.document_id,
            pdf_path=temp_pdf_path,
            pages=ocr_pages,
            request_id="manual-ocr-cli",
        )
        rows_saved = persistence.persist(
            organization_id=args.organization_id,
            document_id=args.document_id,
            ocr_summary=summary,
            min_text_length=settings.ocr_min_text_length,
        )
        print(f"pages_processed={summary.pages_processed}")
        print(f"pages_succeeded={summary.pages_succeeded}")
        print(f"total_text_length={summary.total_ocr_text_length}")
        print(f"rows_saved={rows_saved}")
        print(f"low_confidence_pages={summary.low_confidence_pages}")
        print(f"failed_pages={summary.failed_pages}")
    finally:
        cleanup_temp_file(temp_pdf_path)


if __name__ == "__main__":
    main()
