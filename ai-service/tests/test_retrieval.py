import math
import threading
import unittest
import uuid
import sys
from types import SimpleNamespace
from unittest.mock import patch

from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.models import EmbeddingError
from app.retrieval.models import RetrievalError
from app.retrieval.query_validator import RetrievalQueryValidator
from app.retrieval.repository import SEARCH_SQL
from app.retrieval.service import RetrievalService
from app.retrieval.evidence_mapper import EvidenceMapper
from app.retrieval.query_cache import QueryEmbeddingCache
from app.embeddings.sentence_transformer_provider import SentenceTransformerEmbeddingProvider


ORG = str(uuid.uuid4())
DOC = str(uuid.uuid4())


def settings():
    return SimpleNamespace(retrieval_query_max_characters=20, retrieval_query_max_tokens=5,
        retrieval_default_top_k=5, retrieval_max_top_k=20,
        retrieval_default_min_similarity=.25, retrieval_max_document_filters=20)


def configuration():
    return EmbeddingConfiguration(provider="sentence_transformers", model="model", model_revision="rev",
        dimension=384, normalize=True, library_version="3.3.1")


def unit_vector():
    return [1.0] + [0.0] * 383


class FakeProvider:
    def __init__(self, vector=None):
        self.vector = unit_vector() if vector is None else vector
        self.calls = 0
    def embed_query(self, text):
        self.calls += 1
        return list(self.vector)


class FakeRepository:
    def __init__(self, rows=None, eligible=1):
        self.rows = rows or []
        self.eligible = eligible
        self.filters = []
        self.searches = []
    def validate_document_filters(self, organization_id, document_ids): self.filters.append((organization_id, document_ids))
    def eligible_embedding_count(self, organization_id, configuration, document_ids): return self.eligible
    def search_exact(self, **kwargs): self.searches.append(kwargs); return list(self.rows), 2
    def load_evidence_blocks(self, **kwargs): return {}


def request(**changes):
    values = dict(organization_id=ORG, query="invoice", top_k=5, minimum_similarity=.25,
                  document_id=None, document_ids=None, include_content=True)
    values.update(changes)
    return RetrievalQueryValidator(settings()).validate(**values)


class QueryValidationTests(unittest.TestCase):
    def setUp(self): self.validator = RetrievalQueryValidator(settings())
    def validate(self, **changes):
        values = dict(organization_id=ORG, query="invoice", top_k=5, minimum_similarity=.25)
        values.update(changes); return self.validator.validate(**values)
    def code(self, expected, **changes):
        with self.assertRaises(RetrievalError) as caught: self.validate(**changes)
        self.assertEqual(caught.exception.error_code, expected)
    def test_empty_query(self): self.code("RETRIEVAL_QUERY_EMPTY", query="")
    def test_whitespace_query(self): self.code("RETRIEVAL_QUERY_EMPTY", query="  \n")
    def test_query_too_long(self): self.code("RETRIEVAL_QUERY_TOO_LONG", query="x" * 21)
    def test_query_too_many_tokens(self): self.code("RETRIEVAL_QUERY_TOO_LONG", query="a b c d e f")
    def test_zero_top_k(self): self.code("RETRIEVAL_TOP_K_INVALID", top_k=0)
    def test_top_k_above_max(self): self.code("RETRIEVAL_TOP_K_INVALID", top_k=21)
    def test_boolean_top_k(self): self.code("RETRIEVAL_TOP_K_INVALID", top_k=True)
    def test_invalid_threshold(self): self.code("RETRIEVAL_THRESHOLD_INVALID", minimum_similarity=1.1)
    def test_malformed_document(self): self.code("RETRIEVAL_DOCUMENT_FILTER_INVALID", document_id="bad")
    def test_contradictory_documents(self): self.code("RETRIEVAL_DOCUMENT_FILTER_INVALID", document_id=DOC, document_ids=[DOC])
    def test_duplicate_documents(self): self.code("RETRIEVAL_DOCUMENT_FILTER_INVALID", document_ids=[DOC, DOC])
    def test_query_is_trimmed_without_mutating_caller(self):
        original = "  invoice  "; result = self.validate(query=original)
        self.assertEqual(original, "  invoice  "); self.assertEqual(result.query, "invoice")
    def test_sql_injection_text_is_data(self):
        result = self.validate(query="';--")
        self.assertEqual(result.query, "';--")


class RetrievalServiceTests(unittest.TestCase):
    def build(self, repository=None, provider=None, capacity=4):
        return RetrievalService(repository=repository or FakeRepository(), provider=provider or FakeProvider(),
            configuration=configuration(), max_concurrent_requests=capacity)
    def test_query_vector_dimension_is_384(self):
        repo=FakeRepository(); self.build(repo).search(request())
        self.assertEqual(len(repo.searches[0]["query_vector"]), 384)
    def test_nan_rejected(self):
        vector=unit_vector(); vector[2]=math.nan
        with self.assertRaises(RetrievalError) as caught: self.build(provider=FakeProvider(vector)).search(request())
        self.assertEqual(caught.exception.error_code, "QUERY_VECTOR_INVALID")
    def test_infinity_rejected(self):
        vector=unit_vector(); vector[2]=math.inf
        with self.assertRaises(RetrievalError): self.build(provider=FakeProvider(vector)).search(request())
    def test_non_normalized_rejected(self):
        vector=unit_vector(); vector[0]=2
        with self.assertRaises(RetrievalError): self.build(provider=FakeProvider(vector)).search(request())
    def test_no_active_configuration(self):
        with self.assertRaises(RetrievalError) as caught: self.build(FakeRepository(eligible=0)).search(request())
        self.assertEqual(caught.exception.error_code, "ACTIVE_EMBEDDING_CONFIGURATION_NOT_AVAILABLE")
    def test_no_results_is_success(self):
        result=self.build(FakeRepository()).search(request())
        self.assertEqual(result["results"], []); self.assertEqual(result["result_count"], 0)
    def test_provider_embed_query_is_used_once(self):
        provider=FakeProvider(); self.build(provider=provider).search(request())
        self.assertEqual(provider.calls, 1)
    def test_score_mapping_and_metadata(self):
        row={"similarity_score":.8,"cosine_distance":.2,"document_id":DOC,"document_title":"title",
             "chunk_id":1,"chunk_index":2,"content":"evidence","section_title":None,"page_start":9,"page_end":9,
             "source_pages":[9],"content_types":["IMAGE_TEXT"],"source_block_ids":[],
             "content_fingerprint":"a"*64,"metadata":{"source":"image"}}
        result=self.build(FakeRepository([row])).search(request())["results"][0]
        self.assertEqual(result["similarity_score"], .8); self.assertEqual(result["source_pages"], [9])
    def test_document_filter_is_forwarded(self):
        repo=FakeRepository(); self.build(repo).search(request(document_id=DOC))
        self.assertEqual(repo.searches[0]["document_ids"], [DOC])
    def test_capacity_returns_busy(self):
        service=self.build(capacity=1); self.assertTrue(service._capacity.acquire(False))
        with self.assertRaises(RetrievalError) as caught: service.search(request())
        self.assertEqual(caught.exception.error_code, "RETRIEVAL_SERVICE_BUSY")
        service._capacity.release()
    def test_concurrent_searches_return_independent_results(self):
        service=self.build(capacity=2); outputs=[]
        threads=[threading.Thread(target=lambda: outputs.append(service.search(request())["results"])) for _ in range(2)]
        [thread.start() for thread in threads]; [thread.join() for thread in threads]
        self.assertEqual(outputs, [[], []])


class ExactSqlTests(unittest.TestCase):
    def test_tenant_scope_is_enforced_on_all_tables(self):
        self.assertGreaterEqual(SEARCH_SQL.count("organization_id=%(organization_id)s"), 3)
    def test_stale_embeddings_are_excluded(self):
        self.assertIn("e.content_fingerprint=c.content_fingerprint", SEARCH_SQL)
    def test_model_configuration_is_enforced(self):
        self.assertIn("e.embedding_configuration_fingerprint=%(configuration_fingerprint)s", SEARCH_SQL)
        self.assertIn("e.embedding_model_revision=%(model_revision)s", SEARCH_SQL)
    def test_deleted_and_not_ready_are_excluded(self):
        self.assertIn("d.deleted_at IS NULL", SEARCH_SQL); self.assertIn("d.processing_stage='RETRIEVAL_READY'", SEARCH_SQL)
    def test_pending_and_failed_chunks_are_excluded(self): self.assertIn("c.embedding_status='COMPLETED'", SEARCH_SQL)
    def test_score_is_one_minus_distance(self): self.assertIn("1.0-cosine_distance", SEARCH_SQL)
    def test_deterministic_ordering(self):
        self.assertIn("ORDER BY cosine_distance ASC,document_id ASC,chunk_index ASC,chunk_id ASC", SEARCH_SQL)
    def test_vector_and_filters_are_parameters(self): self.assertNotIn("{query_vector}", SEARCH_SQL)


class EvidenceMapperTests(unittest.TestCase):
    def setUp(self):
        self.mapper=EvidenceMapper(); self.block_id=str(uuid.uuid4()); self.source_id=str(uuid.uuid4())
        self.row={"document_id":DOC,"chunk_id":7,"content_fingerprint":"a"*64,
                  "section_title":None,"source_block_ids":[self.block_id],"metadata":{}}
    def block(self, **changes):
        values={"id":self.block_id,"organization_id":ORG,"document_id":DOC,"page_number":2,"block_order":1,
                "block_type":"TABLE","source_type":"DOCUMENT_TABLE","page_text_id":None,"table_id":self.source_id,
                "image_id":None,"image_text_id":None,"block_text":"Net payable ₹45,814.94","metadata":{},"reference_page":False}
        values.update(changes); return values
    def mapped(self, query="What is the net payable?", block=None):
        return self.mapper.map_result(organization_id=ORG,query=query,row=self.row,
            blocks={self.block_id:block or self.block()},seen=set())
    def test_single_page_exact_evidence(self): self.assertEqual(self.mapped()["primary_evidence_page"],2)
    def test_table_evidence_preserves_table_id(self): self.assertEqual(self.mapped()["evidence"][0]["table_id"],self.source_id)
    def test_image_text_uses_exact_parent_page(self):
        image_text=str(uuid.uuid4()); result=self.mapped("Bay C-07 receipt note",self.block(page_number=9,block_type="IMAGE_TEXT",
            source_type="DOCUMENT_IMAGE_TEXT",table_id=None,image_id=str(uuid.uuid4()),image_text_id=image_text,
            block_text="Bay C-07 receipt note Counted 46 amber vials"))
        self.assertEqual(result["primary_evidence_page"],9); self.assertEqual(result["evidence"][0]["image_text_id"],image_text)
    def test_checklist_is_not_primary(self):
        result=self.mapped(block=self.block(page_number=10,reference_page=True))
        self.assertIsNone(result["primary_evidence_page"]); self.assertEqual(result["secondary_reference_pages"],[10])
    def test_exact_span_is_returned(self):
        evidence=self.mapped()["evidence"][0]
        self.assertIsNotNone(evidence["text_start"]); self.assertIn("45,814.94",evidence["matched_text"])
    def test_missing_alignment_degrades_safely(self):
        result=self.mapped("unrelated",self.block(block_text="")); self.assertEqual(result["citation_precision"],"BLOCK_LEVEL")
    def test_evidence_id_is_deterministic(self):
        self.assertEqual(self.mapped()["evidence"][0]["evidence_id"],self.mapped()["evidence"][0]["evidence_id"])
    def test_wrong_tenant_block_is_rejected(self):
        result=self.mapped(block=self.block(organization_id=str(uuid.uuid4()))); self.assertEqual(result["evidence"],[])
    def test_wrong_document_block_is_rejected(self):
        result=self.mapped(block=self.block(document_id=str(uuid.uuid4()))); self.assertEqual(result["evidence"],[])
    def test_seen_citation_is_deduplicated(self):
        first=self.mapped()["evidence"][0]["evidence_id"]
        result=self.mapper.map_result(organization_id=ORG,query="net payable",row=self.row,
            blocks={self.block_id:self.block()},seen={first}); self.assertEqual(result["evidence"],[])


class QueryCacheTests(unittest.TestCase):
    def test_hit_returns_copy(self):
        cache=QueryEmbeddingCache(enabled=True,max_entries=2,ttl_seconds=10); cache.put("a",[1.0]); value=cache.get("a"); value[0]=2
        self.assertEqual(cache.get("a"),[1.0])
    def test_miss(self): self.assertIsNone(QueryEmbeddingCache(enabled=True,max_entries=2,ttl_seconds=10).get("a"))
    def test_disabled(self):
        cache=QueryEmbeddingCache(enabled=False,max_entries=2,ttl_seconds=10); cache.put("a",[1.0]); self.assertIsNone(cache.get("a"))
    def test_size_is_bounded(self):
        cache=QueryEmbeddingCache(enabled=True,max_entries=2,ttl_seconds=10)
        [cache.put(str(i),[float(i)]) for i in range(3)]; self.assertEqual(cache.stats()["cache_size"],2); self.assertIsNone(cache.get("0"))
    def test_configuration_safe_cache_key_causes_miss(self):
        provider=FakeProvider(); repo=FakeRepository(); cache=QueryEmbeddingCache(enabled=True,max_entries=2,ttl_seconds=10)
        service=RetrievalService(repository=repo,provider=provider,configuration=configuration(),query_cache=cache)
        service.search(request()); service.search(request()); self.assertEqual(provider.calls,1)
    def test_ttl_expiry(self):
        cache=QueryEmbeddingCache(enabled=True,max_entries=2,ttl_seconds=1)
        with patch("app.retrieval.query_cache.time.monotonic",side_effect=[0,0.5,2]):
            cache.put("a",[1]); self.assertEqual(cache.get("a"),[1]); self.assertIsNone(cache.get("a"))


class ProviderLifecycleTests(unittest.TestCase):
    class Model:
        loads=0
        def __init__(self,*args,**kwargs): self.__class__.loads+=1
        def get_sentence_embedding_dimension(self): return 384
    def setUp(self): self.Model.loads=0
    def test_model_loads_once(self):
        module=SimpleNamespace(SentenceTransformer=self.Model); provider=SentenceTransformerEmbeddingProvider(configuration())
        with patch.dict(sys.modules,{"sentence_transformers":module}): provider.load_model(); provider.load_model()
        self.assertEqual(provider.model_load_count,1); self.assertEqual(self.Model.loads,1)
    def test_concurrent_first_load_creates_one_model(self):
        module=SimpleNamespace(SentenceTransformer=self.Model); provider=SentenceTransformerEmbeddingProvider(configuration())
        with patch.dict(sys.modules,{"sentence_transformers":module}):
            threads=[threading.Thread(target=provider.load_model) for _ in range(4)]
            [x.start() for x in threads]; [x.join() for x in threads]
        self.assertEqual(provider.model_load_count,1); self.assertEqual(self.Model.loads,1)
    def test_runtime_diagnostics_do_not_expose_vectors(self):
        info=SentenceTransformerEmbeddingProvider(configuration()).runtime_info()
        self.assertNotIn("vector",info); self.assertEqual(info["model_load_count"],0)


if __name__ == "__main__": unittest.main()
