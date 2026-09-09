import math
import unittest
from unittest.mock import patch

from app.retrieval.evaluation import category_metrics, metrics
from app.retrieval.hybrid import HybridConfiguration, fuse, normalize_query, suppress_duplicates, validate_scores
from app.retrieval.reranker import CrossEncoderReranker
from app.retrieval.repository import LEXICAL_SEARCH_SQL


def row(chunk, document="00000000-0000-0000-0000-000000000001", index=0, content="distinct", score=.8):
    return {"chunk_id": chunk, "document_id": document, "chunk_index": index, "content": content,
            "content_fingerprint": f"{chunk:064x}", "similarity_score": score, "lexical_score": score}


class FusionTests(unittest.TestCase):
    def test_vector_and_lexical_only_are_retained(self):
        result=fuse([row(1)], [row(2)], HybridConfiguration(mode="HYBRID")); self.assertEqual({x["chunk_id"] for x in result},{1,2})
    def test_both_has_exact_rrf_score(self):
        result=fuse([row(1)], [row(1)], HybridConfiguration(mode="HYBRID",rrf_k=60))[0]
        self.assertAlmostEqual(result["fusion_score"],2/61); self.assertEqual(result["retrieval_source"],"BOTH")
    def test_raw_scores_are_not_added(self): self.assertNotAlmostEqual(fuse([row(1,score=.9)],[row(1,score=.7)],HybridConfiguration(mode="HYBRID"))[0]["fusion_score"],1.6)
    def test_tie_is_deterministic(self):
        self.assertEqual([x["chunk_id"] for x in fuse([row(2,index=2),row(1,index=1)],[],HybridConfiguration(mode="HYBRID"))],[2,1])
    def test_candidate_limit(self): self.assertEqual(len(fuse([row(i) for i in range(5)],[],HybridConfiguration(mode="HYBRID",fusion_candidate_k=2,rerank_candidate_k=2,final_top_k=2))),2)


class DedupTests(unittest.TestCase):
    def test_exact_fingerprint_removed(self):
        a=row(1); b=row(2); b["content_fingerprint"]=a["content_fingerprint"]
        selected,removed=suppress_duplicates([a,b],5); self.assertEqual((len(selected),removed),(1,1))
    def test_overlap_removed(self):
        a=row(1,content="one two three four five six seven eight nine ten")
        b=row(2,content="one two three four five six seven eight nine ten extra")
        self.assertEqual(suppress_duplicates([a,b],5)[1],1)
    def test_cross_document_distinct_preserved(self):
        a=row(1,content="same text"); b=row(2,document="00000000-0000-0000-0000-000000000002",content="same text")
        self.assertEqual(len(suppress_duplicates([a,b],5)[0]),2)


class LexicalSqlTests(unittest.TestCase):
    def test_tenant_predicate_precedes_limit(self): self.assertLess(LEXICAL_SEARCH_SQL.index("c.organization_id=%(organization_id)s"),LEXICAL_SEARCH_SQL.index("LIMIT"))
    def test_active_and_deleted_filters(self):
        self.assertIn("d.deleted_at IS NULL",LEXICAL_SEARCH_SQL); self.assertIn("c.embedding_status='COMPLETED'",LEXICAL_SEARCH_SQL)
    def test_safe_query_constructors(self):
        self.assertIn("websearch_to_tsquery",LEXICAL_SEARCH_SQL); self.assertIn("plainto_tsquery",LEXICAL_SEARCH_SQL)
    def test_parameterized(self): self.assertIn("%(query)s",LEXICAL_SEARCH_SQL)
    def test_deterministic_order(self): self.assertIn("document_id ASC,chunk_index ASC,chunk_id ASC",LEXICAL_SEARCH_SQL)


class RerankerTests(unittest.TestCase):
    class Model:
        def predict(self,pairs,**kwargs): return [float(i) for i in range(len(pairs))]
    def test_batched_and_ordered(self):
        reranker=CrossEncoderReranker("model","revision",3); reranker._model=self.Model()
        result=reranker.rerank("q",[row(1),row(2)]); self.assertEqual([x["chunk_id"] for x in result],[2,1])
    def test_invalid_scores_rejected(self):
        with self.assertRaises(ValueError): validate_scores([math.nan],1)
    def test_model_load_once(self):
        reranker=CrossEncoderReranker("m","r"); sentinel=object()
        with patch("sentence_transformers.CrossEncoder",return_value=sentinel) as constructor:
            self.assertIs(reranker.load_model(),reranker.load_model()); constructor.assert_called_once()


class NormalizationAndMetricsTests(unittest.TestCase):
    def test_normalization_preserves_identifiers(self): self.assertEqual(normalize_query("  INV/26-27/0048\n ₹45,814.94 ",100),"INV/26-27/0048 ₹45,814.94")
    def test_metrics(self):
        result=metrics([{"relevant_chunk_ids":[2],"ranked_chunk_ids":[1,2],"answerable":True}])
        self.assertEqual(result["recall_at_1"],0); self.assertEqual(result["recall_at_3"],1); self.assertEqual(result["mrr_at_5"],.5)
    def test_unanswerable_empty_is_correct(self): self.assertEqual(metrics([{"relevant_chunk_ids":[],"ranked_chunk_ids":[],"answerable":False}])["hit_rate_at_5"],0)
    def test_category_breakdown(self): self.assertIn("semantic",category_metrics([{"category":"semantic","relevant_chunk_ids":[1],"ranked_chunk_ids":[1]}]))


if __name__ == "__main__": unittest.main()
