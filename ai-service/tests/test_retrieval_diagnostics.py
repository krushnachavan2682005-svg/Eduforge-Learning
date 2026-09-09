import unittest
import uuid
from unittest.mock import patch

from app.embeddings.configuration import EmbeddingConfiguration
from app.retrieval.hybrid import HybridConfiguration
from app.retrieval.models import RetrievalDiagnostics, RetrievalError, RetrievalRequest
from app.retrieval.service import RetrievalService
from app.config.settings import _env_bool

ORG=str(uuid.uuid4()); DOC=str(uuid.uuid4())
def row(index=1):
    return {"similarity_score":.8,"lexical_score":.7,"cosine_distance":.2,"document_id":DOC,"document_title":"title",
            "chunk_id":index,"chunk_index":index,"content":f"evidence {index}","section_title":None,"page_start":1,"page_end":1,
            "source_pages":[1],"content_types":["TEXT"],"source_block_ids":[],"content_fingerprint":f"{index:064x}","metadata":{}}
class Provider:
    def embed_query(self,_): return [1.0]+[0.0]*383
class Repository:
    def validate_document_filters(self,*_): pass
    def eligible_embedding_count(self,*_): return 1
    def search_exact(self,**_): return [row(1)],2
    def search_lexical(self,**_): return [row(1),row(2)],3
    def load_evidence_blocks(self,**_): return {}
class Reranker:
    def rerank(self,_query,rows): return list(reversed(rows))
class BrokenReranker:
    def rerank(self,_query,_rows): raise ValueError("unsafe detail")

def service(mode,reranker=None):
    config=EmbeddingConfiguration(provider="sentence_transformers",model="model",model_revision="rev",dimension=384,normalize=True,library_version="x")
    hybrid=HybridConfiguration(mode=mode,vector_candidate_k=5,lexical_candidate_k=5,fusion_candidate_k=5,rerank_candidate_k=5,final_top_k=5)
    return RetrievalService(repository=Repository(),provider=Provider(),configuration=config,hybrid_configuration=hybrid,reranker=reranker)
def request(mode): return RetrievalRequest(ORG,"secret raw query",5,.1,[DOC],True,mode)

class RetrievalDiagnosticsTests(unittest.TestCase):
    def diagnostics(self,mode,reranker=None): return service(mode,reranker).search(request(mode))["retrieval_diagnostics"]
    def test_vector_has_only_applicable_search_stages(self):
        d=self.diagnostics("VECTOR");self.assertIsNotNone(d["vectorSqlMs"]);self.assertIsNone(d["lexicalSqlMs"]);self.assertIsNone(d["fusionMs"]);self.assertIsNone(d["rerankerMs"])
    def test_lexical_has_only_lexical_search_stage(self):
        d=self.diagnostics("LEXICAL");self.assertIsNotNone(d["lexicalSqlMs"]);self.assertIsNone(d["queryEmbeddingMs"]);self.assertIsNone(d["vectorSqlMs"])
    def test_hybrid_has_vector_lexical_and_fusion(self):
        d=self.diagnostics("HYBRID");self.assertTrue(all(d[x] is not None for x in ("vectorSqlMs","lexicalSqlMs","fusionMs")))
    def test_rerank_applied_is_accurate(self):
        d=self.diagnostics("HYBRID_RERANK",Reranker());self.assertTrue(d["rerankerApplied"]);self.assertEqual(d["effectiveMode"],"HYBRID_RERANK");self.assertGreater(d["rerankCandidateCount"],0)
    def test_disabled_reranker_falls_back_safely(self):
        d=self.diagnostics("HYBRID_RERANK");self.assertEqual((d["effectiveMode"],d["rerankerFallbackReason"]),("HYBRID","RERANKER_DISABLED"));self.assertFalse(d["rerankerApplied"])
    def test_reranker_failure_is_sanitized(self):
        d=self.diagnostics("HYBRID_RERANK",BrokenReranker());self.assertEqual(d["rerankerFallbackReason"],"RERANKER_INVALID_SCORE");self.assertNotIn("unsafe",str(d))
    def test_contract_has_no_content(self):
        text=str(self.diagnostics("HYBRID"));self.assertNotIn("secret raw query",text);self.assertNotIn("evidence 1",text)
    def test_empty_results_still_have_complete_diagnostics(self):
        repo=Repository();repo.search_exact=lambda **_: ([],1);repo.search_lexical=lambda **_: ([],1)
        config=EmbeddingConfiguration(provider="sentence_transformers",model="m",model_revision="r",dimension=384,normalize=True,library_version="x")
        result=RetrievalService(repository=repo,provider=Provider(),configuration=config,hybrid_configuration=HybridConfiguration(mode="HYBRID")).search(request("HYBRID"))
        self.assertEqual(result["retrieval_diagnostics"]["finalEvidenceCount"],0)
    def test_model_rejects_negative_and_nonfinite_values(self):
        with self.assertRaises(ValueError): RetrievalDiagnostics("VECTOR","VECTOR",False,False,vector_candidate_count=-1)
        with self.assertRaises(ValueError): RetrievalDiagnostics("VECTOR","VECTOR",False,False,total_retrieval_ms=float("nan"))
    def test_partial_failure_preserves_only_measured_stages(self):
        repo=Repository();repo.search_exact=lambda **_: (_ for _ in ()).throw(RuntimeError("database secret"))
        config=EmbeddingConfiguration(provider="sentence_transformers",model="m",model_revision="r",dimension=384,normalize=True,library_version="x")
        with self.assertRaises(RetrievalError) as caught:
            RetrievalService(repository=repo,provider=Provider(),configuration=config,hybrid_configuration=HybridConfiguration(mode="VECTOR")).search(request("VECTOR"))
        d=caught.exception.diagnostics;self.assertIsNotNone(d["queryEmbeddingMs"]);self.assertIsNotNone(d["vectorSqlMs"]);self.assertIsNone(d["lexicalSqlMs"]);self.assertNotIn("database secret",str(d))

class RolloutConfigurationTests(unittest.TestCase):
    def test_invalid_boolean_fails_validation(self):
        with patch.dict("os.environ",{"RAG_RERANK_ENABLED":"sometimes"}):
            with self.assertRaises(ValueError): _env_bool("RAG_RERANK_ENABLED",False)
    def test_invalid_candidate_relationship_fails_validation(self):
        with self.assertRaises(ValueError): HybridConfiguration(fusion_candidate_k=10,rerank_candidate_k=4,final_top_k=5).validate()
    def test_vector_and_hybrid_rerank_remain_available(self):
        self.assertEqual(HybridConfiguration(mode="VECTOR").validate().mode,"VECTOR")
        self.assertEqual(HybridConfiguration(mode="HYBRID_RERANK").validate().mode,"HYBRID_RERANK")

if __name__=="__main__": unittest.main()
