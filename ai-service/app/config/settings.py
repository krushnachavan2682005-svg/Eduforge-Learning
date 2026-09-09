import os
import shutil
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE_PATH = PROJECT_ROOT / ".env"


@dataclass(frozen=True)
class Settings:
    ai_service_internal_key: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_bucket: str
    database_url: str
    ai_service_temp_dir: str
    env_file_path: Path
    ocr_engine: str
    ocr_language: str
    ocr_render_scale: float
    ocr_min_text_length: int
    tesseract_cmd: str
    image_ocr_enabled: bool
    image_ocr_min_width: int
    image_ocr_min_height: int
    image_ocr_render_scale: float
    image_ocr_language: str
    image_ocr_accept_confidence: float
    image_ocr_fallback_enabled: bool
    chunk_target_tokens: int
    chunk_max_tokens: int
    chunk_min_tokens: int
    chunk_overlap_tokens: int
    header_footer_min_pages: int
    header_footer_occurrence_ratio: float
    header_top_band_ratio: float
    footer_bottom_band_ratio: float
    header_footer_similarity: float
    embedding_provider: str
    embedding_model: str
    embedding_model_revision: str
    embedding_dimension: int
    embedding_normalize: bool
    embedding_batch_size: int
    embedding_max_batch_tokens: int
    embedding_window_tokens: int
    embedding_max_retries: int
    embedding_device: str
    embedding_document_prefix: str
    embedding_query_prefix: str
    embedding_processing_timeout_seconds: int
    retrieval_default_top_k: int
    retrieval_max_top_k: int
    retrieval_default_min_similarity: float
    retrieval_query_max_characters: int
    retrieval_query_max_tokens: int
    retrieval_max_document_filters: int
    retrieval_database_timeout_ms: int
    retrieval_total_timeout_ms: int
    retrieval_max_concurrent_requests: int
    retrieval_slow_query_threshold_ms: int
    retrieval_model_busy_timeout_ms: int
    retrieval_query_cache_enabled: bool
    retrieval_query_cache_max_entries: int
    retrieval_query_cache_ttl_seconds: int
    rag_retrieval_mode: str
    rag_vector_candidate_k: int
    rag_lexical_candidate_k: int
    rag_fusion_candidate_k: int
    rag_rerank_candidate_k: int
    rag_final_top_k: int
    rag_rrf_k: int
    rag_vector_weight: float
    rag_lexical_weight: float
    rag_rerank_enabled: bool
    rag_rerank_model: str
    rag_rerank_model_revision: str
    rag_rerank_batch_size: int
    rag_rerank_timeout_ms: int
    rag_llm_provider: str
    groq_api_key: str
    rag_llm_model: str
    rag_llm_timeout_seconds: int
    rag_llm_temperature: float
    rag_llm_top_p: float
    rag_llm_max_output_tokens: int
    rag_llm_context_window: int
    rag_llm_json_mode: bool
    rag_llm_structured_output_mode: str
    rag_llm_allow_json_mode_fallback: bool
    rag_llm_max_retries: int
    rag_llm_retry_base_delay_ms: int
    rag_llm_retry_max_delay_ms: int
    rag_total_timeout_seconds: int
    rag_question_max_characters: int
    rag_question_max_tokens: int
    rag_retrieval_top_k: int
    rag_max_retrieval_top_k: int
    rag_minimum_similarity: float
    rag_max_context_tokens: int
    rag_max_evidence_items: int
    rag_max_documents_per_request: int
    rag_max_concurrent_generations: int
    rag_busy_timeout_ms: int
    conversation_summary_enabled: bool
    conversation_summary_trigger_messages: int
    conversation_summary_trigger_tokens: int
    conversation_summary_max_tokens: int
    conversation_summary_max_facts: int
    conversation_summary_max_topics: int
    conversation_recent_message_limit: int
    conversation_recent_token_limit: int
    conversation_summary_timeout_seconds: int
    conversation_summary_max_output_tokens: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    load_dotenv(ENV_FILE_PATH, override=False)

    return Settings(
        ai_service_internal_key=_required_env("AI_SERVICE_INTERNAL_KEY"),
        supabase_url=_required_env("SUPABASE_URL"),
        supabase_service_role_key=_required_env("SUPABASE_SERVICE_ROLE_KEY"),
        supabase_bucket=_required_env("SUPABASE_BUCKET"),
        database_url=_required_env("DATABASE_URL"),
        ai_service_temp_dir=_required_env("AI_SERVICE_TEMP_DIR"),
        env_file_path=ENV_FILE_PATH,
        ocr_engine=os.getenv("OCR_ENGINE", "tesseract"),
        ocr_language=os.getenv("OCR_LANGUAGE", "eng"),
        ocr_render_scale=float(os.getenv("OCR_RENDER_SCALE", "2.0")),
        ocr_min_text_length=int(os.getenv("OCR_MIN_TEXT_LENGTH", "20")),
        tesseract_cmd=os.getenv("TESSERACT_CMD", ""),
        image_ocr_enabled=_env_bool("IMAGE_OCR_ENABLED", True),
        image_ocr_min_width=int(os.getenv("IMAGE_OCR_MIN_WIDTH", "80")),
        image_ocr_min_height=int(os.getenv("IMAGE_OCR_MIN_HEIGHT", "40")),
        image_ocr_render_scale=float(os.getenv("IMAGE_OCR_RENDER_SCALE", "3.0")),
        image_ocr_language=os.getenv("IMAGE_OCR_LANGUAGE", os.getenv("OCR_LANGUAGE", "eng")),
        image_ocr_accept_confidence=float(os.getenv("IMAGE_OCR_ACCEPT_CONFIDENCE", "70")),
        image_ocr_fallback_enabled=_env_bool("IMAGE_OCR_FALLBACK_ENABLED", True),
        chunk_target_tokens=int(os.getenv("CHUNK_TARGET_TOKENS", "800")),
        chunk_max_tokens=int(os.getenv("CHUNK_MAX_TOKENS", "1000")),
        chunk_min_tokens=int(os.getenv("CHUNK_MIN_TOKENS", "150")),
        chunk_overlap_tokens=int(os.getenv("CHUNK_OVERLAP_TOKENS", "120")),
        header_footer_min_pages=int(os.getenv("HEADER_FOOTER_MIN_PAGES", "3")),
        header_footer_occurrence_ratio=float(os.getenv("HEADER_FOOTER_OCCURRENCE_RATIO", "0.60")),
        header_top_band_ratio=float(os.getenv("HEADER_TOP_BAND_RATIO", "0.12")),
        footer_bottom_band_ratio=float(os.getenv("FOOTER_BOTTOM_BAND_RATIO", "0.12")),
        header_footer_similarity=float(os.getenv("HEADER_FOOTER_SIMILARITY", "0.92")),
        embedding_provider=os.getenv("EMBEDDING_PROVIDER", "sentence_transformers"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
        embedding_model_revision=os.getenv(
            "EMBEDDING_MODEL_REVISION", "5c38ec7c405ec4b44b94cc5a9bb96e735b38267a"
        ),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "384")),
        embedding_normalize=_env_bool("EMBEDDING_NORMALIZE", True),
        embedding_batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "32")),
        embedding_max_batch_tokens=int(os.getenv("EMBEDDING_MAX_BATCH_TOKENS", "8192")),
        embedding_window_tokens=int(os.getenv("EMBEDDING_WINDOW_TOKENS", "510")),
        embedding_max_retries=int(os.getenv("EMBEDDING_MAX_RETRIES", "3")),
        embedding_device=os.getenv("EMBEDDING_DEVICE", "cpu"),
        embedding_document_prefix=os.getenv("EMBEDDING_DOCUMENT_PREFIX", ""),
        embedding_query_prefix=os.getenv(
            "EMBEDDING_QUERY_PREFIX", "Represent this sentence for searching relevant passages: "
        ),
        embedding_processing_timeout_seconds=int(
            os.getenv("EMBEDDING_PROCESSING_TIMEOUT_SECONDS", "900")
        ),
        retrieval_default_top_k=int(os.getenv("RETRIEVAL_DEFAULT_TOP_K", "5")),
        retrieval_max_top_k=int(os.getenv("RETRIEVAL_MAX_TOP_K", "20")),
        retrieval_default_min_similarity=float(os.getenv("RETRIEVAL_DEFAULT_MIN_SIMILARITY", "0.57")),
        retrieval_query_max_characters=int(os.getenv("RETRIEVAL_QUERY_MAX_CHARACTERS", "2000")),
        retrieval_query_max_tokens=int(os.getenv("RETRIEVAL_QUERY_MAX_TOKENS", "256")),
        retrieval_max_document_filters=int(os.getenv("RETRIEVAL_MAX_DOCUMENT_FILTERS", "20")),
        retrieval_database_timeout_ms=int(os.getenv("RETRIEVAL_DATABASE_TIMEOUT_MS", "5000")),
        retrieval_total_timeout_ms=int(os.getenv("RETRIEVAL_TOTAL_TIMEOUT_MS", "60000")),
        retrieval_max_concurrent_requests=int(os.getenv("RETRIEVAL_MAX_CONCURRENT_REQUESTS", "4")),
        retrieval_slow_query_threshold_ms=int(os.getenv("RETRIEVAL_SLOW_QUERY_THRESHOLD_MS", "500")),
        retrieval_model_busy_timeout_ms=int(os.getenv("RETRIEVAL_MODEL_BUSY_TIMEOUT_MS", "1000")),
        retrieval_query_cache_enabled=_env_bool("RETRIEVAL_QUERY_CACHE_ENABLED", True),
        retrieval_query_cache_max_entries=int(os.getenv("RETRIEVAL_QUERY_CACHE_MAX_ENTRIES", "256")),
        retrieval_query_cache_ttl_seconds=int(os.getenv("RETRIEVAL_QUERY_CACHE_TTL_SECONDS", "300")),
        rag_retrieval_mode=os.getenv("RAG_RETRIEVAL_MODE", "HYBRID").upper(),
        rag_vector_candidate_k=int(os.getenv("RAG_VECTOR_CANDIDATE_K", "30")),
        rag_lexical_candidate_k=int(os.getenv("RAG_LEXICAL_CANDIDATE_K", "30")),
        rag_fusion_candidate_k=int(os.getenv("RAG_FUSION_CANDIDATE_K", "20")),
        rag_rerank_candidate_k=int(os.getenv("RAG_RERANK_CANDIDATE_K", "12")),
        rag_final_top_k=int(os.getenv("RAG_FINAL_TOP_K", "5")),
        rag_rrf_k=int(os.getenv("RAG_RRF_K", "60")),
        rag_vector_weight=float(os.getenv("RAG_VECTOR_WEIGHT", "1.0")),
        rag_lexical_weight=float(os.getenv("RAG_LEXICAL_WEIGHT", "1.0")),
        rag_rerank_enabled=_env_bool("RAG_RERANK_ENABLED", False),
        rag_rerank_model=os.getenv("RAG_RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L6-v2"),
        rag_rerank_model_revision=os.getenv("RAG_RERANK_MODEL_REVISION", "c5ee24cb16019beea0893ab7796b1df96625c6b8"),
        rag_rerank_batch_size=int(os.getenv("RAG_RERANK_BATCH_SIZE", "8")),
        rag_rerank_timeout_ms=int(os.getenv("RAG_RERANK_TIMEOUT_MS", "10000")),
        rag_llm_provider=os.getenv("RAG_LLM_PROVIDER", "groq"),
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
        rag_llm_model=os.getenv("RAG_LLM_MODEL", "openai/gpt-oss-20b"),
        rag_llm_timeout_seconds=int(os.getenv("RAG_LLM_TIMEOUT_SECONDS", "60")),
        rag_llm_temperature=float(os.getenv("RAG_LLM_TEMPERATURE", "0")),
        rag_llm_top_p=float(os.getenv("RAG_LLM_TOP_P", "1")),
        rag_llm_max_output_tokens=int(os.getenv("RAG_LLM_MAX_OUTPUT_TOKENS", "512")),
        rag_llm_context_window=int(os.getenv("RAG_LLM_CONTEXT_WINDOW", "8192")),
        rag_llm_json_mode=_env_bool("RAG_LLM_JSON_MODE", True),
        rag_llm_structured_output_mode=os.getenv("RAG_LLM_STRUCTURED_OUTPUT_MODE", "strict_json_schema"),
        rag_llm_allow_json_mode_fallback=_env_bool("RAG_LLM_ALLOW_JSON_MODE_FALLBACK", False),
        rag_llm_max_retries=int(os.getenv("RAG_LLM_MAX_RETRIES", "2")),
        rag_llm_retry_base_delay_ms=int(os.getenv("RAG_LLM_RETRY_BASE_DELAY_MS", "500")),
        rag_llm_retry_max_delay_ms=int(os.getenv("RAG_LLM_RETRY_MAX_DELAY_MS", "4000")),
        rag_total_timeout_seconds=int(os.getenv("RAG_TOTAL_TIMEOUT_SECONDS", "120")),
        rag_question_max_characters=int(os.getenv("RAG_QUESTION_MAX_CHARACTERS", "2000")),
        rag_question_max_tokens=int(os.getenv("RAG_QUESTION_MAX_TOKENS", "256")),
        rag_retrieval_top_k=int(os.getenv("RAG_RETRIEVAL_TOP_K", "5")),
        rag_max_retrieval_top_k=int(os.getenv("RAG_MAX_RETRIEVAL_TOP_K", "10")),
        rag_minimum_similarity=float(os.getenv("RAG_MINIMUM_SIMILARITY", "0.57")),
        rag_max_context_tokens=int(os.getenv("RAG_MAX_CONTEXT_TOKENS", "5000")),
        rag_max_evidence_items=int(os.getenv("RAG_MAX_EVIDENCE_ITEMS", "12")),
        rag_max_documents_per_request=int(os.getenv("RAG_MAX_DOCUMENTS_PER_REQUEST", "10")),
        rag_max_concurrent_generations=int(os.getenv("RAG_MAX_CONCURRENT_GENERATIONS", "2")),
        rag_busy_timeout_ms=int(os.getenv("RAG_BUSY_TIMEOUT_MS", "1000")),
        conversation_summary_enabled=_env_bool("CONVERSATION_SUMMARY_ENABLED", True),
        conversation_summary_trigger_messages=int(os.getenv("CONVERSATION_SUMMARY_TRIGGER_MESSAGES", "12")),
        conversation_summary_trigger_tokens=int(os.getenv("CONVERSATION_SUMMARY_TRIGGER_TOKENS", "2500")),
        conversation_summary_max_tokens=int(os.getenv("CONVERSATION_SUMMARY_MAX_TOKENS", "700")),
        conversation_summary_max_facts=int(os.getenv("CONVERSATION_SUMMARY_MAX_FACTS", "20")),
        conversation_summary_max_topics=int(os.getenv("CONVERSATION_SUMMARY_MAX_TOPICS", "10")),
        conversation_recent_message_limit=int(os.getenv("CONVERSATION_RECENT_MESSAGE_LIMIT", "8")),
        conversation_recent_token_limit=int(os.getenv("CONVERSATION_RECENT_TOKEN_LIMIT", "1500")),
        conversation_summary_timeout_seconds=int(os.getenv("CONVERSATION_SUMMARY_TIMEOUT_SECONDS", "30")),
        conversation_summary_max_output_tokens=int(os.getenv("CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS", "1200")),
    )


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is missing. Check {ENV_FILE_PATH} and make sure the Python server "
            "was restarted after editing env variables."
        )
    return value


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}: return True
    if normalized in {"0", "false", "no", "off"}: return False
    raise ValueError(f"{name} must be a boolean")


def startup_config_check() -> dict[str, bool | str]:
    settings = get_settings()
    tesseract_status = get_tesseract_status(settings)
    return {
        "env_file_path": str(settings.env_file_path),
        "SUPABASE_URL present": bool(settings.supabase_url),
        "SUPABASE_SERVICE_ROLE_KEY present": bool(settings.supabase_service_role_key),
        "SUPABASE_BUCKET present": bool(settings.supabase_bucket),
        "DATABASE_URL present": bool(settings.database_url),
        "AI_SERVICE_INTERNAL_KEY present": bool(settings.ai_service_internal_key),
        "AI_SERVICE_TEMP_DIR present": bool(settings.ai_service_temp_dir),
        "OCR_ENGINE present": bool(settings.ocr_engine),
        "OCR_LANGUAGE present": bool(settings.ocr_language),
        "OCR_RENDER_SCALE": str(settings.ocr_render_scale),
        "OCR_MIN_TEXT_LENGTH": str(settings.ocr_min_text_length),
        "TESSERACT_CMD present": bool(settings.tesseract_cmd),
        "TESSERACT_CMD exists": tesseract_status["cmd_exists"],
        "TESSERACT_AVAILABLE": tesseract_status["available"],
        "TESSERACT_VERSION": tesseract_status["version"],
        "IMAGE_OCR_ENABLED": settings.image_ocr_enabled,
        "IMAGE_OCR_MIN_WIDTH": str(settings.image_ocr_min_width),
        "IMAGE_OCR_MIN_HEIGHT": str(settings.image_ocr_min_height),
        "IMAGE_OCR_RENDER_SCALE": str(settings.image_ocr_render_scale),
        "IMAGE_OCR_LANGUAGE": settings.image_ocr_language,
        "IMAGE_OCR_ACCEPT_CONFIDENCE": str(settings.image_ocr_accept_confidence),
        "IMAGE_OCR_FALLBACK_ENABLED": settings.image_ocr_fallback_enabled,
        "CHUNK_TARGET_TOKENS": str(settings.chunk_target_tokens),
        "CHUNK_MAX_TOKENS": str(settings.chunk_max_tokens),
        "CHUNK_MIN_TOKENS": str(settings.chunk_min_tokens),
        "CHUNK_OVERLAP_TOKENS": str(settings.chunk_overlap_tokens),
        "EMBEDDING_PROVIDER": settings.embedding_provider,
        "EMBEDDING_MODEL": settings.embedding_model,
        "EMBEDDING_MODEL_REVISION": settings.embedding_model_revision,
        "EMBEDDING_DIMENSION": str(settings.embedding_dimension),
        "EMBEDDING_NORMALIZE": settings.embedding_normalize,
        "EMBEDDING_BATCH_SIZE": str(settings.embedding_batch_size),
        "EMBEDDING_MAX_BATCH_TOKENS": str(settings.embedding_max_batch_tokens),
        "EMBEDDING_WINDOW_TOKENS": str(settings.embedding_window_tokens),
        "EMBEDDING_DEVICE": settings.embedding_device,
    }


def get_tesseract_status(settings: Settings) -> dict[str, bool | str | None]:
    command = settings.tesseract_cmd or "tesseract"
    cmd_exists = bool(settings.tesseract_cmd and Path(settings.tesseract_cmd).exists()) or shutil.which(command) is not None

    if not cmd_exists:
        return {
            "cmd_exists": False,
            "available": False,
            "version": None,
        }

    try:
        result = subprocess.run(
            [command, "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        first_line = (result.stdout or result.stderr).splitlines()[0] if (result.stdout or result.stderr) else ""
        return {
            "cmd_exists": True,
            "available": result.returncode == 0,
            "version": first_line,
        }
    except Exception:
        return {
            "cmd_exists": cmd_exists,
            "available": False,
            "version": None,
        }
