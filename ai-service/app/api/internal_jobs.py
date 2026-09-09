from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.agents.document_processing_agent import DocumentProcessingAgent
from app.config.settings import get_settings
from app.config.settings import get_tesseract_status
from app.database.repositories import DocumentProcessingRepository
from app.errors import error_body
from app.embeddings.factory import build_embedding_components
from app.embeddings.models import EmbeddingError

router = APIRouter(prefix="/internal/jobs", tags=["internal-jobs"])


class ProcessDocumentRequest(BaseModel):
    job_id: str
    document_id: str
    organization_id: str
    owner_user_id: str
    storage_bucket: str
    storage_key: str
    mime_type: str = Field(pattern="^application/pdf$")
    file_size_bytes: int = Field(ge=1)
    processing_type: str = Field(pattern="^PREPROCESS_PDF$")


class EmbedDocumentRequest(BaseModel):
    job_id: str
    document_id: str
    organization_id: str
    processing_type: str = Field(pattern="^EMBEDDING$")


@router.post("/embed-document")
def embed_document(
    payload: EmbedDocumentRequest,
    request: Request,
    x_internal_service_key: str = Header(default="", alias="X-Internal-Service-Key"),
    x_request_id: str | None = Header(default=None, alias="X-Request-Id"),
) -> dict[str, Any]:
    request_id = x_request_id or request.headers.get("x-request-id") or "missing-request-id"
    settings = get_settings()
    if x_internal_service_key != settings.ai_service_internal_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_body(
                error_code="INTERNAL_SERVICE_UNAUTHORIZED", message="Invalid internal service key",
                request_id=request_id, retryable=False,
            ),
        )
    _, _, _, _, pipeline = build_embedding_components(settings)
    try:
        summary = pipeline.run(
            organization_id=payload.organization_id, document_id=payload.document_id,
            job_id=payload.job_id,
        )
    except EmbeddingError as exc:
        status_code = (
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.error_code.startswith("PGVECTOR_") or exc.error_code.startswith("EMBEDDING_MODEL_")
            else status.HTTP_404_NOT_FOUND if exc.error_code == "DOCUMENT_NOT_FOUND"
            else status.HTTP_409_CONFLICT if exc.error_code == "EMBEDDING_JOB_ALREADY_RUNNING"
            else status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status_code,
            detail=error_body(
                error_code=exc.error_code, message=exc.message,
                details={"organization_id": payload.organization_id, "document_id": payload.document_id},
                request_id=request_id, retryable=exc.retryable,
            ),
        ) from exc
    return {
        "success": summary.outcome == "COMPLETED", "job_id": payload.job_id,
        "document_id": payload.document_id, "status": summary.outcome,
        "result": summary.to_dict(),
    }


@router.post("/process-document")
def process_document(
    payload: ProcessDocumentRequest,
    request: Request,
    x_internal_service_key: str = Header(default="", alias="X-Internal-Service-Key"),
    x_request_id: str | None = Header(default=None, alias="X-Request-Id"),
) -> dict[str, Any]:
    request_id = x_request_id or request.headers.get("x-request-id") or "missing-request-id"
    settings = get_settings()

    if x_internal_service_key != settings.ai_service_internal_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_body(
                error_code="INTERNAL_SERVICE_UNAUTHORIZED",
                message="Invalid internal service key",
                request_id=request_id,
                retryable=False,
            ),
        )

    repository = DocumentProcessingRepository(settings.database_url)
    agent = DocumentProcessingAgent(settings, repository)

    try:
        result = agent.process_job(payload.model_dump(), request_id)
        return {
            "success": True,
            "job_id": payload.job_id,
            "document_id": payload.document_id,
            "status": "COMPLETED",
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as exc:
        details = {
            "document_id": payload.document_id,
            "organization_id": payload.organization_id,
            "storage_bucket": payload.storage_bucket,
            "storage_key": payload.storage_key,
        }
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_body(
                error_code="PDF_PREPROCESSING_FAILED",
                message=str(exc) or "Failed to preprocess PDF",
                details=details,
                request_id=request_id,
                retryable=True,
            ),
        ) from exc


@router.get("/ocr/health")
def ocr_health(
    x_internal_service_key: str = Header(default="", alias="X-Internal-Service-Key"),
) -> dict[str, Any]:
    settings = get_settings()
    if x_internal_service_key != settings.ai_service_internal_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_body(
                error_code="INTERNAL_SERVICE_UNAUTHORIZED",
                message="Invalid internal service key",
                request_id="ocr-health",
                retryable=False,
            ),
        )

    status_info = get_tesseract_status(settings)
    return {
        "ocr_engine": settings.ocr_engine,
        "ocr_language": settings.ocr_language,
        "tesseract_cmd_configured": bool(settings.tesseract_cmd),
        "tesseract_cmd_exists": status_info["cmd_exists"],
        "tesseract_available": status_info["available"],
        "version": status_info["version"],
    }
