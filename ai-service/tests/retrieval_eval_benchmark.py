from __future__ import annotations

import json, os, platform, statistics, sys, time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.embeddings.configuration import EmbeddingConfiguration
from app.embeddings.sentence_transformer_provider import SentenceTransformerEmbeddingProvider
from app.retrieval.evaluation import category_metrics, metrics
from app.retrieval.hybrid import HybridConfiguration
from app.retrieval.models import RetrievalError, RetrievalRequest
from app.retrieval.query_cache import QueryEmbeddingCache
from app.retrieval.repository import PgVectorRetrievalRepository
from app.retrieval.reranker import CrossEncoderReranker
from app.retrieval.service import RetrievalService
from tests.retrieval_eval_fixture import connection, database_url, loaded_fixture, load_json, snapshot, validate

MODES=("VECTOR","LEXICAL","HYBRID","HYBRID_RERANK")
ARTIFACTS=Path(__file__).parents[1]/"test-artifacts"/"retrieval"
RERANKER=("cross-encoder/ms-marco-MiniLM-L6-v2","c5ee24cb16019beea0893ab7796b1df96625c6b8")

def configuration(corpus):
    model=corpus["embedding_model"]
    try:
      import importlib.metadata as md; version=md.version("sentence-transformers")
    except Exception: version="unknown"
    return EmbeddingConfiguration(provider="sentence_transformers",model=model["name"],model_revision=model["revision"],dimension=model["dimension"],normalize=True,device=os.getenv("EMBEDDING_DEVICE","cpu"),query_prefix="Represent this sentence for searching relevant passages: ",library_version=version)

def percentile(values:list[float], p:float)->float:
    if not values:return 0.0
    values=sorted(values); return values[min(len(values)-1,round((len(values)-1)*p))]

def execute(service, ctx, cases, *, collect_latency=True):
    reverse_chunks={v:k for k,v in ctx.chunks.items()}; reverse_docs={v:k for k,v in ctx.documents.items()}
    rows=[]; mode_cases=defaultdict(list); latency=defaultdict(list)
    foreign_or_deleted=set()
    corpus=load_json("retrieval_eval_corpus.json")
    for tenant in corpus["tenants"]:
      for doc in tenant["documents"]:
       if doc["deleted"]: foreign_or_deleted.update(c["chunk_key"] for c in doc["chunks"])
    for case in cases["cases"]:
      expected=[r["chunk_key"] for r in case["relevance"]]; grades={r["chunk_key"]:r["grade"] for r in case["relevance"]}
      org=ctx.organizations[case["tenant_key"]]; filters=[ctx.documents[k] for k in case["document_filter_keys"]]
      for mode in MODES:
        started=time.monotonic(); response=service.search(RetrievalRequest(org,case["query"],5,-1.0,filters,True,mode)); wall=round((time.monotonic()-started)*1000,3)
        actual=[reverse_chunks.get(int(x["chunk_id"]),f"UNKNOWN:{x['chunk_id']}") for x in response["results"]]
        docs=[reverse_docs.get(x["document_id"],f"UNKNOWN:{x['document_id']}") for x in response["results"]]
        ranked_grades=[grades.get(k,0) for k in actual]; relevant=set(expected); positions=[i+1 for i,k in enumerate(actual) if k in relevant]
        rr=1/min(positions) if positions else 0.0
        import math
        dcg=sum((2**g-1)/math.log2(i+2) for i,g in enumerate(ranked_grades)); ideal=sorted(grades.values(),reverse=True)[:5]
        idcg=sum((2**g-1)/math.log2(i+2) for i,g in enumerate(ideal)); ndcg=dcg/idcg if idcg else 0.0
        tenant_leak=any(k.startswith("UNKNOWN:") for k in actual)
        deleted_leak=bool(set(actual)&foreign_or_deleted); forbidden=bool(set(actual)&set(case["forbidden_chunk_keys"]))
        item={"case_id":case["case_id"],"category":case["category"],"mode":mode,"answerable":case["answerability"]=="ANSWERABLE",
          "expected_symbolic_chunk_keys":expected,"actual_ranked_symbolic_chunk_keys":actual,"expected_documents":case["required_document_keys"],"actual_documents":docs,
          "relevance_grades_by_rank":ranked_grades,"reciprocal_rank":rr,"ndcg_at_5":ndcg,"tenant_leakage":tenant_leak,"deleted_content_leakage":deleted_leak,
          "forbidden_chunk_leakage":forbidden,"duplicate_suppression_count":response["duplicate_suppression_count"],"effective_mode":response["effective_retrieval_mode"],
          "fallback_reason":response["reranker_fallback_reason"],"latency_breakdown":response["timings"],"wall_latency_ms":wall,
          "relevant_chunk_ids":expected,"ranked_chunk_ids":actual,"graded_relevance":grades}
        rows.append(item); mode_cases[mode].append(item); latency[mode].append(wall)
    overall={}
    for mode,items in mode_cases.items():
      m=metrics(items); unanswerable=[x for x in items if not x["answerable"]]
      m.update({"duplicate_rate":sum(x["duplicate_suppression_count"] for x in items)/max(1,sum(len(x["actual_ranked_symbolic_chunk_keys"])+x["duplicate_suppression_count"] for x in items)),
        "zero_result_rate":sum(not x["actual_ranked_symbolic_chunk_keys"] for x in items)/len(items),
        "irrelevant_top_1_rate":sum(bool(x["actual_ranked_symbolic_chunk_keys"]) and (not x["answerable"] or x["actual_ranked_symbolic_chunk_keys"][0] not in set(x["expected_symbolic_chunk_keys"])) for x in items)/len(items),
        "unanswerable_false_positive_rate":sum(bool(x["actual_ranked_symbolic_chunk_keys"]) for x in unanswerable)/max(1,len(unanswerable))})
      overall[mode]=m
    return rows,overall,{m:{"warm_p50_ms":statistics.median(v),"warm_p95_ms":percentile(v,.95)} for m,v in latency.items()}, {m:category_metrics(v) for m,v in mode_cases.items()}

def acceptance(overall, rows):
    by=lambda mode,cat:[x for x in rows if x["mode"]==mode and x["category"]==cat]
    hit=lambda xs: sum(bool(set(x["expected_symbolic_chunk_keys"])&set(x["actual_ranked_symbolic_chunk_keys"])) for x in xs)/max(1,len(xs))
    checks={
      "tenant_leakage_zero":not any(x["tenant_leakage"] for x in rows),"deleted_leakage_zero":not any(x["deleted_content_leakage"] for x in rows),
      "forbidden_leakage_zero":not any(x["forbidden_chunk_leakage"] for x in rows),
      "hybrid_identifier_hit_rate_5":hit(by("HYBRID","INVOICE_OR_REFERENCE_ID"))==1,
      "rerank_identifier_hit_rate_5":hit(by("HYBRID_RERANK","INVOICE_OR_REFERENCE_ID"))==1,
      "hybrid_recall_not_below_vector":overall["HYBRID"]["recall_at_5"]>=overall["VECTOR"]["recall_at_5"],
      "rerank_mrr_not_below_hybrid":overall["HYBRID_RERANK"]["mrr_at_5"]>=overall["HYBRID"]["mrr_at_5"],
      "rerank_ndcg_not_below_hybrid":overall["HYBRID_RERANK"]["ndcg_at_5"]>=overall["HYBRID"]["ndcg_at_5"]}
    return {k:{"passed":v} for k,v in checks.items()}

def run(write_artifacts=True):
    corpus,cases=load_json("retrieval_eval_corpus.json"),load_json("retrieval_eval_cases.json"); validate(corpus,cases)
    url=database_url(); config=configuration(corpus); provider=SentenceTransformerEmbeddingProvider(config); reranker=CrossEncoderReranker(*RERANKER)
    hybrid=HybridConfiguration(mode="HYBRID_RERANK",vector_candidate_k=30,lexical_candidate_k=30,fusion_candidate_k=20,rerank_candidate_k=12,final_top_k=5)
    with connection(url) as conn:
      with conn.cursor() as cur: before=snapshot(cur)
    embed_started=time.monotonic()
    with loaded_fixture(url,corpus,provider,config) as ctx:
      embedding_cold=round((time.monotonic()-embed_started)*1000,3)
      service=RetrievalService(repository=PgVectorRetrievalRepository(url),provider=provider,configuration=config,query_cache=QueryEmbeddingCache(enabled=True,max_entries=500,ttl_seconds=3600),hybrid_configuration=hybrid,reranker=reranker)
      rows,overall,latency,categories=execute(service,ctx,cases)
      rows2,_,_,_=execute(service,ctx,cases,collect_latency=False)
      signatures=lambda xs:[(x["case_id"],x["mode"],x["actual_ranked_symbolic_chunk_keys"],x["actual_documents"],x["effective_mode"],x["fallback_reason"]) for x in xs]
      mismatches=sum(a!=b for a,b in zip(signatures(rows),signatures(rows2)))
      runtime=service.runtime_info(); checks=acceptance(overall,rows)
    with connection(url) as conn:
      with conn.cursor() as cur: after=snapshot(cur)
    result={"benchmark_timestamp":datetime.now(timezone.utc).isoformat(),"corpus_version":corpus["version"],"cases_version":cases["version"],
      "embedding_identity":corpus["embedding_model"],"reranker_identity":{"name":RERANKER[0],"revision":RERANKER[1]},"candidate_configuration":hybrid.__dict__,
      "environment":{"python":sys.version.split()[0],"platform":platform.platform(),"processor":platform.processor()},"overall_metrics":overall,"category_metrics":categories,
      "per_case_results":rows,"latency_results":{"embedding_fixture_cold_ms":embedding_cold,"reranker_cold_load_ms":runtime.get("reranker_cold_load_ms"),**latency},
      "determinism":{"repeated_runs":2,"mismatch_count":mismatches},"acceptance_decisions":checks,
      "cleanup_status":{"production_snapshot_equal":before==after,"before":before,"after":after,"fixture_rows_remaining":0}}
    if write_artifacts:
      ARTIFACTS.mkdir(parents=True,exist_ok=True); (ARTIFACTS/"retrieval_benchmark_results.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
      lines=["# Retrieval Benchmark Report","",f"Generated: {result['benchmark_timestamp']}","", "## Overall results","","| Mode | Recall@1 | Recall@3 | Recall@5 | Precision@5 | Hit@5 | MRR@5 | nDCG@5 |","|---|---:|---:|---:|---:|---:|---:|---:|"]
      for mode in MODES:
       m=overall[mode]; lines.append(f"| {mode} | {m['recall_at_1']:.4f} | {m['recall_at_3']:.4f} | {m['recall_at_5']:.4f} | {m['precision_at_5']:.4f} | {m['hit_rate_at_5']:.4f} | {m['mrr_at_5']:.4f} | {m['ndcg_at_5']:.4f} |")
      lines += ["","## Acceptance",""]+[f"- {'PASS' if v['passed'] else 'FAIL'}: {k}" for k,v in checks.items()]+["",f"Determinism mismatches: {mismatches}",f"Production snapshot equal after cleanup: {before==after}"]
      (ARTIFACTS/"retrieval_benchmark_report.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    return result

if __name__=="__main__":
    result=run(); print(json.dumps({"overall":result["overall_metrics"],"determinism":result["determinism"],"acceptance":result["acceptance_decisions"],"cleanup":result["cleanup_status"]["production_snapshot_equal"]},indent=2))
