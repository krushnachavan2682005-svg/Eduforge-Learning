from __future__ import annotations

import hashlib, json, os, uuid
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

import psycopg
from dotenv import dotenv_values
from pgvector.psycopg import Vector, register_vector
from psycopg.types.json import Jsonb
from psycopg.rows import dict_row

MARKER = "RETRIEVAL-EVAL-V1"
FIXTURES = Path(__file__).parent / "fixtures"

def load_json(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))

def database_url() -> str:
    value = os.getenv("DATABASE_URL") or dotenv_values(Path(__file__).parents[1] / ".env").get("DATABASE_URL")
    if not value: raise RuntimeError("RETRIEVAL_EVAL_DATABASE_URL_MISSING")
    return str(value)

def connection(url: str):
    conn=psycopg.connect(url,row_factory=dict_row); register_vector(conn); return conn

def validate(corpus: dict[str, Any], cases: dict[str, Any]) -> None:
    if not corpus.get("version") or not cases.get("version"): raise ValueError("version required")
    chunks={}; docs={}
    for tenant in corpus.get("tenants",[]):
      for doc in tenant.get("documents",[]):
        if doc["document_key"] in docs: raise ValueError("duplicate document key")
        docs[doc["document_key"]]=(tenant["tenant_key"],doc)
        for chunk in doc.get("chunks",[]):
          if chunk["chunk_key"] in chunks: raise ValueError("duplicate chunk key")
          chunks[chunk["chunk_key"]]=(tenant["tenant_key"],doc,chunk)
    ids=set()
    for case in cases.get("cases",[]):
      if case["case_id"] in ids: raise ValueError("duplicate case id")
      ids.add(case["case_id"]); rel=case.get("relevance",[])
      for item in rel:
        if item["chunk_key"] not in chunks: raise ValueError("missing chunk reference")
        tenant,doc,_=chunks[item["chunk_key"]]
        if tenant!=case["tenant_key"]: raise ValueError("cross-tenant relevance")
        if item["grade"] not in (1,2,3): raise ValueError("invalid relevance grade")
        if doc["deleted"]: raise ValueError("deleted chunk cannot be relevant")
      if case["answerability"]=="ANSWERABLE" and not rel: raise ValueError("answerable case requires relevance")
      if case["answerability"]=="UNANSWERABLE" and rel: raise ValueError("unanswerable case has relevance")

def snapshot(cur, excluded_orgs: list[str]|None=None) -> dict[str,tuple[int,str]]:
    result={}; excluded_orgs=excluded_orgs or []
    for table in ("documents","document_page_texts","document_content_blocks","document_chunks","document_chunk_embeddings","assistant_messages","citations","conversation_summaries","feedback","rag_observability_events"):
      cur.execute("select to_regclass(%s) name",(f"public.{table}",)); row=cur.fetchone()
      if not row or row["name"] is None: continue
      cur.execute("select exists(select 1 from information_schema.columns where table_schema='public' and table_name=%s and column_name='organization_id') yes",(table,))
      where=" where not (organization_id=any(%s::uuid[]))" if excluded_orgs and cur.fetchone()["yes"] else ""
      args=(excluded_orgs,) if where else ()
      cur.execute(f"select count(*) count,coalesce(md5(string_agg(x,'' order by x)),md5('')) digest from (select row_to_json(t)::text x from {table} t{where}) s",args)
      r=cur.fetchone(); result[table]=(int(r["count"]),r["digest"])
    return result

@dataclass
class FixtureContext:
    organizations: dict[str,str]; users: list[str]; documents: dict[str,str]; chunks: dict[str,int]
    embeddings: list[str]; blocks: list[str]

def cleanup(url: str, ctx: FixtureContext) -> None:
    orgs=list(ctx.organizations.values())
    with connection(url) as conn:
      with conn.cursor() as cur:
        for table in ("document_chunk_embeddings","document_chunks","document_content_blocks","document_page_texts","documents","users"):
          cur.execute(f"delete from {table} where organization_id=any(%s::uuid[])",(orgs,))
        cur.execute("delete from organizations where id=any(%s::uuid[])",(orgs,))

@contextmanager
def loaded_fixture(url: str, corpus: dict[str,Any], provider, config) -> Iterator[FixtureContext]:
    ctx=FixtureContext({},[],{}, {},[],[])
    try:
      all_chunks=[c for t in corpus["tenants"] for d in t["documents"] for c in d["chunks"]]
      vectors=provider.embed_documents([c["content"] for c in all_chunks])
      with connection(url) as conn:
       with conn.cursor() as cur:
        vector_index=0
        for tenant in corpus["tenants"]:
          org,user=str(uuid.uuid4()),str(uuid.uuid4()); ctx.organizations[tenant["tenant_key"]]=org; ctx.users.append(user)
          cur.execute("insert into organizations(id,name,slug) values(%s,%s,%s)",(org,MARKER,f"retrieval-eval-{uuid.uuid4().hex}"))
          cur.execute("insert into users(id,organization_id,email,full_name,role,password_hash) values(%s,%s,%s,%s,'ADMIN','disabled')",(user,org,f"{uuid.uuid4().hex}@invalid.test",MARKER))
          for doc in tenant["documents"]:
            did=str(uuid.uuid4()); ctx.documents[doc["document_key"]]=did
            cur.execute("""insert into documents(id,organization_id,owner_user_id,title,storage_key,content_hash,status,processing_stage,original_file_name,deleted_at,page_count)
              values(%s,%s,%s,%s,%s,%s,'COMPLETED','RETRIEVAL_READY',%s,case when %s then now() else null end,%s)""",
              (did,org,user,doc["title"],f"{MARKER}/{did}",hashlib.sha256(did.encode()).hexdigest(),doc["title"]+'.pdf',doc["deleted"],len(doc["pages"])))
            for chunk in doc["chunks"]:
              page=chunk["page_number"]; text=chunk["content"]; pid,bid=str(uuid.uuid4()),str(uuid.uuid4()); ctx.blocks.append(bid)
              cur.execute("insert into document_page_texts(id,organization_id,document_id,page_number,text,text_length,extraction_method) values(%s,%s,%s,%s,%s,%s,'SYNTHETIC_EVAL')",(pid,org,did,page,text,len(text)))
              cur.execute("insert into document_content_blocks(id,organization_id,document_id,page_number,block_order,block_type,source_type,page_text_id,content_text,readable_text,extraction_method,metadata) values(%s,%s,%s,%s,%s,'TEXT','DOCUMENT_PAGE_TEXT',%s,%s,%s,'SYNTHETIC_EVAL',%s)",(bid,org,did,page,chunk["chunk_index"],pid,text,text,Jsonb({"synthetic_block_type":chunk["block_type"]})))
              fp=hashlib.sha256(text.encode()).hexdigest()
              cur.execute("""insert into document_chunks(organization_id,document_id,chunk_index,content,chunk_text,cleaned_text,token_count,embedding_model,page_start,page_end,section_title,char_count,chunk_type,metadata,embedding_status,source_pages,content_types,source_block_ids,content_fingerprint)
                values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'{}','COMPLETED',%s,%s,%s,%s) returning id""",
                (org,did,chunk["chunk_index"],text,text,text,len(text.split()),config.model,page,page,chunk["section_heading"],len(text),chunk["block_type"],[page],[chunk["block_type"]],[bid],fp))
              cid=int(cur.fetchone()["id"]); ctx.chunks[chunk["chunk_key"]]=cid; eid=str(uuid.uuid4()); ctx.embeddings.append(eid)
              cur.execute("""insert into document_chunk_embeddings(id,organization_id,document_id,chunk_id,chunk_index,content_fingerprint,source_pages,embedding_provider,embedding_model,embedding_model_revision,embedding_dimension,embedding_configuration_fingerprint,embedding,normalized,generation_duration_ms,embedding_attempt,source_token_count)
                values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,1,%s)""",
                (eid,org,did,cid,chunk["chunk_index"],fp,[page],config.provider,config.model,config.model_revision,config.dimension,config.fingerprint,Vector(vectors[vector_index]),config.normalize,len(text.split())))
              vector_index+=1
      yield ctx
    finally:
      if ctx.organizations: cleanup(url,ctx)
