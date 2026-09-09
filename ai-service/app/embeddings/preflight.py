import logging
import importlib.util
import re
import time

from app.embeddings.models import EmbeddingPreflightResult, PreflightCheck
from app.embeddings.provider import EmbeddingProvider
from app.embeddings.validator import EmbeddingVectorValidator

logger = logging.getLogger(__name__)


class EmbeddingEnvironmentPreflightService:
    REQUIRED_CONSTRAINTS = {
        "document_chunk_embeddings_chunk_parent_fk",
        "document_chunk_embeddings_identity_unique",
        "document_chunk_embeddings_dimension_check",
    }
    REQUIRED_INDEXES = {
        "idx_chunk_embeddings_tenant_document",
        "idx_chunk_embeddings_chunk",
        "idx_chunk_embeddings_active_config",
    }

    def __init__(self, repository, provider: EmbeddingProvider, *, dimension: int, normalized: bool) -> None:
        self.repository = repository
        self.provider = provider
        self.validator = EmbeddingVectorValidator(dimension=dimension, normalized=normalized)
        self.dimension = dimension

    def run(self, *, check_model: bool = True) -> EmbeddingPreflightResult:
        started = time.monotonic()
        logger.info("EMBEDDING_PREFLIGHT_START embedding_model=%s embedding_model_revision=%s embedding_dimension=%s embedding_configuration_fingerprint=%s", self.provider.model_name, self.provider.model_version, self.dimension, self.provider.configuration_fingerprint)
        result = EmbeddingPreflightResult()
        try:
            environment = self.repository.environment_info()
            result.checks.append(PreflightCheck("database_connection", "PASS", details={"database": environment["database"]}))
            result.checks.append(PreflightCheck("postgresql_version", "PASS", details={"version": environment["postgresql_version"]}))
        except Exception:
            result.checks.append(PreflightCheck("database_connection", "FAIL", "DATABASE_CONNECTION_FAILED", "Database connection failed"))
            return self._finish(result, started)

        available = bool(environment["vector_available"])
        enabled = bool(environment["vector_enabled"])
        result.checks.append(PreflightCheck(
            "pgvector_available", "PASS" if available else "FAIL",
            None if available else "PGVECTOR_EXTENSION_NOT_AVAILABLE",
            environment.get("vector_available_version") if available else "PostgreSQL server extension files are not installed",
        ))
        result.checks.append(PreflightCheck(
            "pgvector_enabled", "PASS" if enabled else "FAIL",
            None if enabled else ("PGVECTOR_EXTENSION_NOT_ENABLED" if available else "PGVECTOR_EXTENSION_NOT_AVAILABLE"),
            environment.get("vector_enabled_version") if enabled else "vector extension is not enabled",
        ))
        adapter_available = importlib.util.find_spec("pgvector") is not None
        result.checks.append(PreflightCheck(
            "pgvector_python_adapter", "PASS" if adapter_available else "FAIL",
            None if adapter_available else "PGVECTOR_PYTHON_ADAPTER_NOT_INSTALLED",
            None if adapter_available else "Install pgvector from requirements.txt",
        ))

        if enabled:
            schema = self.repository.embedding_schema_info()
            exists = schema["table_exists"]
            result.checks.append(PreflightCheck(
                "embedding_table", "PASS" if exists else "FAIL",
                None if exists else "EMBEDDING_TABLE_NOT_FOUND",
            ))
            if exists:
                match = re.fullmatch(r"vector\((\d+)\)", schema.get("vector_type") or "")
                actual_dimension = int(match.group(1)) if match else None
                dimension_ok = actual_dimension == self.dimension
                result.checks.append(PreflightCheck(
                    "vector_dimension", "PASS" if dimension_ok else "FAIL",
                    None if dimension_ok else "EMBEDDING_DIMENSION_MISMATCH",
                    details={"configured": self.dimension, "database": actual_dimension},
                ))
                missing_constraints = sorted(self.REQUIRED_CONSTRAINTS - set(schema["constraints"]))
                missing_indexes = sorted(self.REQUIRED_INDEXES - set(schema["indexes"]))
                result.checks.append(PreflightCheck(
                    "embedding_constraints", "PASS" if not missing_constraints else "FAIL",
                    None if not missing_constraints else "EMBEDDING_SCHEMA_INCOMPLETE",
                    details={"missing": missing_constraints},
                ))
                result.checks.append(PreflightCheck(
                    "embedding_indexes", "PASS" if not missing_indexes else "FAIL",
                    None if not missing_indexes else "EMBEDDING_SCHEMA_INCOMPLETE",
                    details={"missing": missing_indexes},
                ))

        if check_model:
            try:
                self.provider.load_model()
                sample = self.provider.embed_documents(["Embedding environment validation sample."])
                validated = self.validator.validate_batch(sample, expected_count=1)
                norm = sum(value * value for value in validated[0]) ** 0.5
                result.checks.append(PreflightCheck(
                    "embedding_model_load", "PASS", details={
                        "model": self.provider.model_name,
                        "revision": self.provider.model_version,
                        "sample_dimension": len(validated[0]),
                        "finite": True,
                        "l2_norm": round(norm, 6),
                        "configuration_fingerprint": self.provider.configuration_fingerprint,
                    },
                ))
            except Exception as exc:
                code = getattr(exc, "error_code", "EMBEDDING_MODEL_LOAD_FAILED")
                result.checks.append(PreflightCheck("embedding_model_load", "FAIL", code, str(exc)))
        return self._finish(result, started)

    @staticmethod
    def _finish(result: EmbeddingPreflightResult, started: float) -> EmbeddingPreflightResult:
        event = "EMBEDDING_PREFLIGHT_PASSED" if result.passed else "EMBEDDING_PREFLIGHT_FAILED"
        getattr(logger, "info" if result.passed else "error")(
            "%s blocking_reason=%s duration_ms=%s", event, result.blocking_reason,
            round((time.monotonic() - started) * 1000),
        )
        return result
