import copy, math
import pytest

from app.retrieval.evaluation import dcg_at_k, metrics, ndcg_at_k, reciprocal_rank
from tests.retrieval_eval_fixture import load_json, validate

def fixtures(): return load_json("retrieval_eval_corpus.json"),load_json("retrieval_eval_cases.json")
def test_fixtures_validate_and_cover_requirements():
    c,q=fixtures(); validate(c,q)
    docs=[d for t in c["tenants"] for d in t["documents"]]; chunks=[x for d in docs for x in d["chunks"]]
    assert len(c["tenants"])==2 and len(docs)>=12 and sum(d["deleted"] for d in docs)==2 and sum(x["expected_state"]=="ACTIVE" for x in chunks)>=50
    assert len(q["cases"])>=48 and len({x["category"] for x in q["cases"]})==18
def mutation(path,value,message):
    c,q=fixtures(); target={"corpus":c,"cases":q}[path[0]]
    for key in path[1:-1]: target=target[key]
    target[path[-1]]=value
    with pytest.raises(ValueError,match=message): validate(c,q)
def test_versions_required(): mutation(("corpus","version"),None,"version")
def test_duplicate_case_rejected():
    c,q=fixtures(); q["cases"].append(copy.deepcopy(q["cases"][0]));
    with pytest.raises(ValueError,match="duplicate case"): validate(c,q)
def test_duplicate_chunk_rejected():
    c,q=fixtures(); c["tenants"][0]["documents"][0]["chunks"].append(copy.deepcopy(c["tenants"][0]["documents"][0]["chunks"][0]))
    with pytest.raises(ValueError,match="duplicate chunk"): validate(c,q)
def test_missing_reference_rejected():
    c,q=fixtures(); next(x for x in q["cases"] if x["relevance"])["relevance"][0]["chunk_key"]="MISSING"
    with pytest.raises(ValueError,match="missing chunk"): validate(c,q)
def test_invalid_grade_rejected():
    c,q=fixtures(); next(x for x in q["cases"] if x["relevance"])["relevance"][0]["grade"]=4
    with pytest.raises(ValueError,match="invalid relevance"): validate(c,q)
def test_hand_calculated_metrics():
    cases=[{"answerable":True,"relevant_chunk_ids":["a","b"],"ranked_chunk_ids":["x","a","y","b"],"graded_relevance":{"a":3,"b":2}}]
    m=metrics(cases); assert m["recall_at_1"]==0 and m["recall_at_3"]==.5 and m["recall_at_5"]==1
    assert m["precision_at_5"]==.4 and m["hit_rate_at_5"]==1 and m["mrr_at_5"]==.5
    assert reciprocal_rank(["x","a"],{"a"})==.5
    assert dcg_at_k([3,2])==pytest.approx(7+3/math.log2(3))
    assert ndcg_at_k([2,3],[3,2])==pytest.approx(dcg_at_k([2,3])/dcg_at_k([3,2]))
def test_unanswerable_excluded_from_quality_denominator():
    m=metrics([{"answerable":False,"relevant_chunk_ids":[],"ranked_chunk_ids":[]},{"answerable":True,"relevant_chunk_ids":[1],"ranked_chunk_ids":[1]}])
    assert m["recall_at_5"]==1 and m["ndcg_at_5"]==1
