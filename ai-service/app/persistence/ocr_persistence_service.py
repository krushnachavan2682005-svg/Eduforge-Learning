from app.database.repositories import DocumentProcessingRepository, OCRSchemaNotReadyError
from app.schemas.ocr import OCRSummary


class OCRPersistenceError(Exception):
    pass


class OCRPersistenceService:
    def __init__(self, repository: DocumentProcessingRepository) -> None:
        self.repository = repository

    def persist(
        self,
        *,
        job_id: str,
        organization_id: str,
        document_id: str,
        ocr_summary: OCRSummary,
        min_text_length: int,
    ) -> int:
        try:
            return self.repository.persist_ocr_results(
                job_id=job_id,
                organization_id=organization_id,
                document_id=document_id,
                ocr_summary=ocr_summary,
                min_text_length=min_text_length,
            )
        except OCRSchemaNotReadyError:
            raise
        except Exception as exc:
            raise OCRPersistenceError("Failed to persist OCR results") from exc
