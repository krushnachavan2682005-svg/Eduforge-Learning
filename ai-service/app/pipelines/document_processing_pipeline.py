from typing import Any

from fastapi import HTTPException, status

from app.config.settings import Settings
from app.database.repositories import DocumentProcessingRepository, RepositoryError
from app.errors import error_body
from app.parsers.pymupdf_parser import InvalidPdfFileError, PdfPreprocessingError, preprocess_pdf
from app.storage.object_storage import ObjectStorage, PdfDownloadFailedError, StorageObjectNotFoundError
from app.storage.temp_files import cleanup_temp_file, write_temp_pdf


class DocumentProcessingPipeline:
    def __init__(self, settings: Settings, repository: DocumentProcessingRepository) -> None:
        self.settings = settings
        self.repository = repository
        self.storage = ObjectStorage(settings)

    def process(self, payload: dict[str, Any], request_id: str) -> dict[str, int | bool | str]:
        temp_path: str | None = None

        try:
            self.repository.prepare_job(
                job_id=payload["job_id"],
                document_id=payload["document_id"],
                organization_id=payload["organization_id"],
            )

            storage_bucket = payload.get("storage_bucket") or self.settings.supabase_bucket
            pdf_bytes = self.storage.download_pdf(storage_bucket, payload["storage_key"])
            temp_path = write_temp_pdf(pdf_bytes, self.settings.ai_service_temp_dir)
            result = preprocess_pdf(temp_path)

            self.repository.mark_success(
                job_id=payload["job_id"],
                document_id=payload["document_id"],
                organization_id=payload["organization_id"],
                page_count=int(result["page_count"]),
                text_length=int(result["text_length"]),
            )
            return result
        except RepositoryError as exc:
            self._mark_failed(payload, exc.error_code, exc.message)
            raise self._http_error(
                status_code=status.HTTP_409_CONFLICT if exc.error_code == "JOB_ALREADY_RUNNING" else status.HTTP_404_NOT_FOUND,
                error_code=exc.error_code,
                message=exc.message,
                payload=payload,
                request_id=request_id,
                retryable=exc.retryable,
            ) from exc
        except StorageObjectNotFoundError as exc:
            self._mark_failed(payload, "STORAGE_OBJECT_NOT_FOUND", str(exc))
            raise self._http_error(
                status_code=status.HTTP_404_NOT_FOUND,
                error_code="STORAGE_OBJECT_NOT_FOUND",
                message="Storage object not found",
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except PdfDownloadFailedError as exc:
            self._mark_failed(payload, "PDF_DOWNLOAD_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_502_BAD_GATEWAY,
                error_code="PDF_DOWNLOAD_FAILED",
                message="Failed to download PDF from storage",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except InvalidPdfFileError as exc:
            self._mark_failed(payload, "INVALID_PDF_FILE", str(exc))
            raise self._http_error(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                error_code="INVALID_PDF_FILE",
                message="Invalid PDF file",
                payload=payload,
                request_id=request_id,
                retryable=False,
            ) from exc
        except PdfPreprocessingError as exc:
            self._mark_failed(payload, "PDF_PREPROCESSING_FAILED", str(exc))
            raise self._http_error(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                error_code="PDF_PREPROCESSING_FAILED",
                message="Failed to preprocess PDF",
                payload=payload,
                request_id=request_id,
                retryable=True,
            ) from exc
        except Exception as exc:
            self._mark_failed(payload, "PDF_PREPROCESSING_FAILED", str(exc))
            raise
        finally:
            cleanup_temp_file(temp_path)

    def _mark_failed(self, payload: dict[str, Any], error_code: str, message: str) -> None:
        try:
            self.repository.mark_failed(
                job_id=payload["job_id"],
                document_id=payload["document_id"],
                organization_id=payload["organization_id"],
                error_code=error_code,
                error_message=message,
            )
        except Exception as exc:
            raise RuntimeError("JOB_UPDATE_FAILED") from exc

    def _http_error(
        self,
        *,
        status_code: int,
        error_code: str,
        message: str,
        payload: dict[str, Any],
        request_id: str,
        retryable: bool,
    ) -> HTTPException:
        return HTTPException(
            status_code=status_code,
            detail=error_body(
                error_code=error_code,
                message=message,
                details={
                    "document_id": payload["document_id"],
                    "organization_id": payload["organization_id"],
                    "storage_bucket": payload["storage_bucket"],
                    "storage_key": payload["storage_key"],
                },
                request_id=request_id,
                retryable=retryable,
            ),
        )


