from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.config.settings import get_settings
from app.errors import error_body
from app.retrieval.factory import get_retrieval_components
from app.retrieval.models import RetrievalError

router = APIRouter(prefix="/internal/retrieval", tags=["internal-retrieval"])


def _authorize_internal_service(key: str, request_id: str) -> None:
    if key != get_settings().ai_service_internal_key:
        raise HTTPException(401, detail=error_body(error_code="INTERNAL_SERVICE_UNAUTHORIZED",
            message="Invalid internal service key", request_id=request_id))


class RetrievalSearchRequest(BaseModel):
    organization_id: str
    query: str
    document_id: str | None = None
    document_ids: list[str] | None = None
    top_k: int | None = None
    minimum_similarity: float | None = None
    include_content: bool = True
    retrieval_mode: str | None = None


@router.post("/search")
def search(payload: RetrievalSearchRequest, request: Request,
           x_internal_service_key: str = Header(default="", alias="X-Internal-Service-Key"),
           x_request_id: str | None = Header(default=None, alias="X-Request-Id")) -> dict[str, Any]:
    request_id = x_request_id or request.headers.get("x-request-id") or "missing-request-id"
    settings = get_settings()
    _authorize_internal_service(x_internal_service_key, request_id)
    validator, service, _, _ = get_retrieval_components(settings)
    try:
        validated = validator.validate(**payload.model_dump())
        return service.search(validated, correlation_id=request_id)
    except RetrievalError as exc:
        raise HTTPException(exc.status_code, detail=error_body(error_code=exc.error_code,
            message=exc.message, request_id=request_id, retryable=exc.retryable)) from exc


@router.get("/runtime")
def runtime(request: Request,
            x_internal_service_key: str = Header(default="", alias="X-Internal-Service-Key"),
            x_request_id: str | None = Header(default=None, alias="X-Request-Id")) -> dict[str, Any]:
    request_id = x_request_id or request.headers.get("x-request-id") or "missing-request-id"
    _authorize_internal_service(x_internal_service_key, request_id)
    _, service, _, _ = get_retrieval_components()
    return service.runtime_info()
