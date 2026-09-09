import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.api.internal_jobs import router as internal_jobs_router
from app.api.internal_retrieval import router as internal_retrieval_router
from app.api.internal_rag import router as internal_rag_router
from app.api.internal_structured_extractions import router as internal_structured_extractions_router
from app.config.settings import startup_config_check
from app.retrieval.factory import get_retrieval_components
from app.rag.factory import get_rag_components

import uuid
import contextvars

correlation_id: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="")

class CorrelationIdFilter(logging.Filter):
    def filter(self, record):
        record.correlation_id = correlation_id.get()
        return True

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:[%(correlation_id)s] %(message)s")
logger = logging.getLogger()
logger.addFilter(CorrelationIdFilter())

app = FastAPI(title="Document Intelligence AI Service")
app.include_router(internal_jobs_router)
app.include_router(internal_retrieval_router)
app.include_router(internal_rag_router)
app.include_router(internal_structured_extractions_router)

@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    cid = request.headers.get("x-correlation-id") or request.headers.get("x-request-id") or str(uuid.uuid4())
    token = correlation_id.set(cid)
    response = await call_next(request)
    response.headers["X-Correlation-Id"] = cid
    correlation_id.reset(token)
    return response


@app.on_event("startup")
def validate_configuration() -> None:
    config_status = startup_config_check()
    print(f"Loaded env file: {config_status['env_file_path']}")
    print(f"SUPABASE_URL present: {config_status['SUPABASE_URL present']}")
    print(f"SUPABASE_SERVICE_ROLE_KEY present: {config_status['SUPABASE_SERVICE_ROLE_KEY present']}")
    print(f"SUPABASE_BUCKET present: {config_status['SUPABASE_BUCKET present']}")
    print(f"DATABASE_URL present: {config_status['DATABASE_URL present']}")
    print(f"AI_SERVICE_INTERNAL_KEY present: {config_status['AI_SERVICE_INTERNAL_KEY present']}")
    print(f"AI_SERVICE_TEMP_DIR present: {config_status['AI_SERVICE_TEMP_DIR present']}")
    print(f"OCR_ENGINE present: {config_status['OCR_ENGINE present']}")
    print(f"OCR_LANGUAGE present: {config_status['OCR_LANGUAGE present']}")
    print(f"OCR_RENDER_SCALE: {config_status['OCR_RENDER_SCALE']}")
    print(f"OCR_MIN_TEXT_LENGTH: {config_status['OCR_MIN_TEXT_LENGTH']}")
    print(f"TESSERACT_CMD present: {config_status['TESSERACT_CMD present']}")
    print(f"TESSERACT_CMD exists: {config_status['TESSERACT_CMD exists']}")
    print(f"TESSERACT_AVAILABLE: {config_status['TESSERACT_AVAILABLE']}")
    print(f"TESSERACT_VERSION: {config_status['TESSERACT_VERSION']}")
    print(f"IMAGE_OCR_ENABLED: {config_status['IMAGE_OCR_ENABLED']}")
    print(f"IMAGE_OCR_MIN_WIDTH: {config_status['IMAGE_OCR_MIN_WIDTH']}")
    print(f"IMAGE_OCR_MIN_HEIGHT: {config_status['IMAGE_OCR_MIN_HEIGHT']}")
    print(f"IMAGE_OCR_RENDER_SCALE: {config_status['IMAGE_OCR_RENDER_SCALE']}")
    print(f"IMAGE_OCR_LANGUAGE: {config_status['IMAGE_OCR_LANGUAGE']}")
    print(f"IMAGE_OCR_ACCEPT_CONFIDENCE: {config_status['IMAGE_OCR_ACCEPT_CONFIDENCE']}")
    print(f"IMAGE_OCR_FALLBACK_ENABLED: {config_status['IMAGE_OCR_FALLBACK_ENABLED']}")

@app.on_event("shutdown")
async def close_rag_provider() -> None:
    await get_rag_components()[2].close()


@app.get("/health")
def health() -> dict:
    _, service, _, _ = get_retrieval_components()
    runtime = service.runtime_info()
    rag_runtime = get_rag_components()[1].runtime_info()
    return {"status": "ok", "retrieval": {"provider_initialized": runtime["provider_initialized"],
        "model_loaded": runtime["model_loaded"], "model_load_count": runtime["model_load_count"],
        "configuration_fingerprint": runtime["configuration_fingerprint"]},
        "rag": {"ready": bool(rag_runtime["api_key_configured"] and rag_runtime["client_initialized"] and
            rag_runtime["model_active"] and rag_runtime["provider_reachable"]),
            "provider": rag_runtime["provider"], "api_key_configured": rag_runtime["api_key_configured"],
            "model_active": rag_runtime["model_active"],
            "structured_output_mode": rag_runtime["structured_output_mode"]}}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    cid = correlation_id.get()
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": "PDF_PREPROCESSING_FAILED",
            "message": str(exc) or "Unhandled preprocessing error",
            "requestId": cid,
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    cid = correlation_id.get()
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_code": "PDF_PREPROCESSING_FAILED",
            "message": str(exc.detail),
            "requestId": cid,
        },
    )
