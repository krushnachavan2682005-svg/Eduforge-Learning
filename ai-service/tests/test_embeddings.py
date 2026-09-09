import math
import unittest
from unittest.mock import patch

from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import (
    EmbeddingChunk, EmbeddingError, EmbeddingPreflightResult, PreflightCheck,
)
from app.embeddings.pipeline import DocumentEmbeddingPipeline
from app.embeddings.preflight import EmbeddingEnvironmentPreflightService
from app.embeddings.validator import EmbeddingVectorValidator


def config(**changes):
    values = dict(
        provider="sentence_transformers", model="BAAI/bge-small-en-v1.5",
        model_revision="revision-a", dimension=384, normalize=True,
        library_version="3.3.1",
    )
    values.update(changes)
    return EmbeddingConfiguration(**values)


def unit_vector(dimension=384):
    return [1.0] + [0.0] * (dimension - 1)


def chunk(index=0, fingerprint=None):
    return EmbeddingChunk(
        id=index + 100, chunk_index=index, content=f"chunk {index}",
        content_fingerprint=fingerprint or f"{index + 1:064x}",
        source_pages=[index + 1], token_count=3, claim_token="claim",
    )


class FakeProvider:
    def __init__(self, configuration=None, fail_calls=None, output_count_delta=0):
        self.configuration = configuration or config()
        self.calls = []
        self.fail_calls = set(fail_calls or [])
        self.output_count_delta = output_count_delta

    model_name = property(lambda self: self.configuration.model)
    model_version = property(lambda self: self.configuration.model_revision)
    embedding_dimension = property(lambda self: self.configuration.dimension)
    configuration_fingerprint = property(lambda self: self.configuration.fingerprint)
    normalize_embeddings = property(lambda self: self.configuration.normalize)

    def load_model(self): pass

    def embed_documents(self, texts):
        self.calls.append(list(texts))
        if len(self.calls) in self.fail_calls:
            raise EmbeddingError("EMBEDDING_PROVIDER_ERROR", "transient", True)
        count = max(0, len(texts) + self.output_count_delta)
        return [unit_vector(self.embedding_dimension) for _ in range(count)]

    def embed_query(self, text): return unit_vector(self.embedding_dimension)


class PassingPreflight:
    def run(self, **_):
        return EmbeddingPreflightResult([PreflightCheck("all", "PASS")])


class FakeRepository:
    def __init__(self, chunks=None, total=None, already_valid=0, completeness=None,
                 persist_error=None, claim_error=None):
        self.chunks = list(chunks or [])
        self.total = len(self.chunks) if total is None else total
        self.already_valid = already_valid
        self.completeness = completeness
        self.persist_error = persist_error
        self.claim_error = claim_error
        self.persisted = []
        self.failed = []
        self.finalized = []
        self.restored = []
        self.mutations = 0

    def inspect_plan(self, **_):
        return {"total_chunks": self.total, "already_valid": self.already_valid,
                "pending": len(self.chunks), "stale": 0, "failed_retryable": 0}

    def claim_chunks(self, **_):
        if self.claim_error: raise self.claim_error
        self.mutations += bool(self.chunks)
        return list(self.chunks)

    def persist_batch(self, **kwargs):
        if self.persist_error: raise self.persist_error
        self.persisted.extend(kwargs["embeddings"])
        return len(kwargs["embeddings"])

    def mark_failed(self, **kwargs):
        self.failed.extend(kwargs["chunks"])

    def restore_claims(self, **kwargs):
        self.restored.extend(kwargs["chunks"])

    def finalize(self, **kwargs):
        self.finalized.append(kwargs["summary"])
        if self.completeness is not None: return self.completeness
        return {"total": self.total, "valid": self.total, "complete": self.total > 0}


def pipeline(repository, provider=None, configuration=None, batch_size=32, retries=1, preflight=None):
    cfg = configuration or config()
    return DocumentEmbeddingPipeline(
        repository=repository, provider=provider or FakeProvider(cfg),
        preflight=preflight or PassingPreflight(), configuration=cfg,
        batch_size=batch_size, max_batch_tokens=8192, max_retries=retries,
        processing_timeout_seconds=900,
    )


class ConfigurationTests(unittest.TestCase):
    def test_deterministic_model_identity(self):
        self.assertEqual(config().fingerprint, config().fingerprint)

    def test_changed_revision_changes_identity(self):
        self.assertNotEqual(config().fingerprint, config(model_revision="revision-b").fingerprint)

    def test_changed_normalization_changes_identity(self):
        self.assertNotEqual(config().fingerprint, config(normalize=False).fingerprint)

    def test_timestamp_is_not_part_of_identity(self):
        self.assertNotIn("timestamp", config().fingerprint_payload())


class VectorValidationTests(unittest.TestCase):
    def setUp(self):
        self.validator = EmbeddingVectorValidator(dimension=384, normalized=True)

    def test_correct_vector_dimension(self):
        self.assertEqual(len(self.validator.validate_vector(unit_vector())), 384)

    def test_invalid_dimension(self):
        with self.assertRaisesRegex(EmbeddingError, "dimension"):
            self.validator.validate_vector(unit_vector(383))

    def test_nan_vector(self):
        vector = unit_vector(); vector[2] = math.nan
        with self.assertRaises(EmbeddingError) as caught: self.validator.validate_vector(vector)
        self.assertEqual(caught.exception.error_code, "EMBEDDING_NON_FINITE_VALUE")

    def test_infinity_vector(self):
        vector = unit_vector(); vector[2] = math.inf
        with self.assertRaises(EmbeddingError) as caught: self.validator.validate_vector(vector)
        self.assertEqual(caught.exception.error_code, "EMBEDDING_NON_FINITE_VALUE")

    def test_negative_infinity_vector(self):
        vector = unit_vector(); vector[2] = -math.inf
        with self.assertRaises(EmbeddingError): self.validator.validate_vector(vector)

    def test_zero_vector(self):
        with self.assertRaises(EmbeddingError) as caught: self.validator.validate_vector([0.0] * 384)
        self.assertEqual(caught.exception.error_code, "EMBEDDING_ZERO_VECTOR")

    def test_normalization(self):
        vector = self.validator.validate_vector(unit_vector())
        self.assertAlmostEqual(math.sqrt(sum(x*x for x in vector)), 1.0, places=6)

    def test_bad_normalization(self):
        with self.assertRaises(EmbeddingError) as caught: self.validator.validate_vector([2.0] + [0.0] * 383)
        self.assertEqual(caught.exception.error_code, "EMBEDDING_NORMALIZATION_FAILED")

    def test_output_count_mismatch(self):
        with self.assertRaises(EmbeddingError) as caught: self.validator.validate_batch([unit_vector()], expected_count=2)
        self.assertEqual(caught.exception.error_code, "EMBEDDING_OUTPUT_COUNT_MISMATCH")

    def test_nested_vector_rejected(self):
        with self.assertRaises(EmbeddingError): self.validator.validate_vector([[1.0]] * 384)


class PipelineTests(unittest.TestCase):
    def test_batch_ordering_preserves_chunk_links(self):
        repository = FakeRepository([chunk(0), chunk(1), chunk(2)])
        pipeline(repository, batch_size=2).run(organization_id="org", document_id="doc")
        self.assertEqual([item.chunk.id for item in repository.persisted], [100, 101, 102])

    def test_total_token_cap_splits_batches(self):
        chunks = [chunk(0), chunk(1)]
        chunks = [EmbeddingChunk(**{**item.__dict__, "token_count": 6000}) for item in chunks]
        repository = FakeRepository(chunks)
        provider = FakeProvider()
        pipeline(repository, provider, batch_size=32).run(organization_id="org", document_id="doc")
        self.assertEqual(provider.calls, [["chunk 0"], ["chunk 1"]])

    def test_idempotent_rerun_generates_nothing(self):
        repository = FakeRepository([], total=3, already_valid=3)
        provider = FakeProvider()
        summary = pipeline(repository, provider).run(organization_id="org", document_id="doc")
        self.assertEqual(provider.calls, [])
        self.assertEqual(summary.generated, 0)

    def test_one_changed_chunk_only(self):
        repository = FakeRepository([chunk(1)], total=3, already_valid=2)
        provider = FakeProvider()
        pipeline(repository, provider).run(organization_id="org", document_id="doc")
        self.assertEqual(provider.calls, [["chunk 1"]])

    def test_model_change_selects_all_chunks(self):
        repository = FakeRepository([chunk(0), chunk(1)], total=2)
        provider = FakeProvider(config(model_revision="revision-b"))
        summary = pipeline(repository, provider, provider.configuration).run(organization_id="org", document_id="doc")
        self.assertEqual(summary.generated, 2)

    def test_partial_batch_failure_keeps_prior_batch(self):
        repository = FakeRepository([chunk(0), chunk(1)], total=2,
                                    completeness={"total": 2, "valid": 1, "complete": False})
        provider = FakeProvider(fail_calls={2})
        summary = pipeline(repository, provider, batch_size=1).run(organization_id="org", document_id="doc")
        self.assertEqual([item.chunk.id for item in repository.persisted], [100])
        self.assertEqual([item.id for item in repository.failed], [101])
        self.assertEqual(summary.outcome, "PARTIAL_FAILED")

    def test_persistence_failure_preserves_previous_state(self):
        repository = FakeRepository([chunk(0)], persist_error=RuntimeError("rollback"),
                                    completeness={"total": 1, "valid": 0, "complete": False})
        with self.assertRaises(EmbeddingError) as caught:
            pipeline(repository).run(organization_id="org", document_id="doc")
        self.assertEqual(repository.persisted, [])
        self.assertEqual(caught.exception.error_code, "EMBEDDING_PERSISTENCE_FAILED")
        self.assertEqual([item.id for item in repository.restored], [100])

    def test_concurrent_worker_exits_safely(self):
        repository = FakeRepository(claim_error=EmbeddingError("EMBEDDING_JOB_ALREADY_RUNNING", "owned", True))
        with self.assertRaises(EmbeddingError) as caught:
            pipeline(repository).run(organization_id="org", document_id="doc")
        self.assertEqual(caught.exception.error_code, "EMBEDDING_JOB_ALREADY_RUNNING")

    def test_stale_processing_claim_can_be_recovered(self):
        repository = FakeRepository([chunk(0)], total=1)
        summary = pipeline(repository).run(organization_id="org", document_id="doc")
        self.assertEqual(summary.generated, 1)

    def test_wrong_tenant_changes_nothing(self):
        repository = FakeRepository(claim_error=EmbeddingError("DOCUMENT_NOT_FOUND", "not found"))
        with self.assertRaises(EmbeddingError) as caught:
            pipeline(repository).run(organization_id="wrong", document_id="doc")
        self.assertEqual(caught.exception.error_code, "DOCUMENT_NOT_FOUND")
        self.assertEqual(repository.mutations, 0)

    def test_zero_chunks_not_retrieval_ready(self):
        repository = FakeRepository([], total=0, completeness={"total": 0, "valid": 0, "complete": False})
        summary = pipeline(repository).run(organization_id="org", document_id="doc")
        self.assertEqual(summary.outcome, "INCOMPLETE")

    def test_partial_embeddings_not_retrieval_ready(self):
        repository = FakeRepository([], total=2, already_valid=1,
                                    completeness={"total": 2, "valid": 1, "complete": False})
        summary = pipeline(repository).run(organization_id="org", document_id="doc")
        self.assertEqual(summary.outcome, "INCOMPLETE")

    def test_complete_embeddings_become_ready(self):
        repository = FakeRepository([chunk(0)], total=1)
        summary = pipeline(repository).run(organization_id="org", document_id="doc")
        self.assertEqual(summary.outcome, "COMPLETED")

    def test_ten_page_chunk_selection_keeps_traceability(self):
        chunks = [EmbeddingChunk(i, i, f"content {i}", f"{i+1:064x}", [min(i+1, 10)], 5, "claim") for i in range(14)]
        repository = FakeRepository(chunks)
        pipeline(repository, batch_size=4).run(organization_id="org", document_id="doc")
        self.assertEqual([item.chunk.source_pages for item in repository.persisted], [x.source_pages for x in chunks])


class EnvironmentPreflightTests(unittest.TestCase):
    class EnvironmentRepository:
        def __init__(self, available, enabled): self.available=available; self.enabled=enabled; self.mutations=0
        def environment_info(self):
            return {"database":"document_intelligence","postgresql_version":"PostgreSQL 18.3",
                    "vector_available":self.available,"vector_available_version":"0.8.1" if self.available else None,
                    "vector_enabled":self.enabled,"vector_enabled_version":"0.8.1" if self.enabled else None}
        def embedding_schema_info(self):
            return {"table_exists":True,"vector_type":"vector(384)",
                    "constraints":EmbeddingEnvironmentPreflightService.REQUIRED_CONSTRAINTS,
                    "indexes":EmbeddingEnvironmentPreflightService.REQUIRED_INDEXES}

    def test_pgvector_unavailable_fails_without_mutation(self):
        repository = self.EnvironmentRepository(False, False)
        result = EmbeddingEnvironmentPreflightService(repository, FakeProvider(), dimension=384, normalized=True).run()
        self.assertEqual(result.blocking_reason, "PGVECTOR_EXTENSION_NOT_AVAILABLE")
        self.assertEqual(repository.mutations, 0)

    def test_pgvector_available_but_disabled(self):
        result = EmbeddingEnvironmentPreflightService(self.EnvironmentRepository(True, False), FakeProvider(), dimension=384, normalized=True).run()
        self.assertEqual(result.blocking_reason, "PGVECTOR_EXTENSION_NOT_ENABLED")

    def test_pgvector_schema_and_model_pass(self):
        with patch("app.embeddings.preflight.importlib.util.find_spec", return_value=object()):
            result = EmbeddingEnvironmentPreflightService(self.EnvironmentRepository(True, True), FakeProvider(), dimension=384, normalized=True).run()
        self.assertTrue(result.passed)


if __name__ == "__main__":
    unittest.main()
