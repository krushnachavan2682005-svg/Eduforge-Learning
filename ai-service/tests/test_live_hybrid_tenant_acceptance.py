"""Live pgvector and four-mode tenant-isolation acceptance.

This module deliberately uses the real RetrievalService and PostgreSQL database.  All
fixture identities are runtime UUIDs and teardown is defensive, so a failed assertion
cannot leave acceptance data behind.
"""

from __future__ import annotations

import ast
import hashlib
import math
import os
import json
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
import pytest
from dotenv import dotenv_values
from pgvector.psycopg import Vector, register_vector
from psycopg.rows import dict_row

from app.embeddings.configuration import EmbeddingConfiguration
from app.retrieval.hybrid import HybridConfiguration
from app.retrieval.models import RetrievalError, RetrievalRequest
from app.retrieval.query_cache import QueryEmbeddingCache
from app.retrieval.repository import PgVectorRetrievalRepository
from app.retrieval.service import RetrievalService


DIMENSION = 384
MODES = ("VECTOR", "LEXICAL", "HYBRID", "HYBRID_RERANK")
MARKER = "LIVE-TENANT-ACCEPTANCE"


def validated_vector(value: Any) -> list[float]:
    """Convert a pgvector/list/text value without ever iterating serialized text."""
    if isinstance(value, Vector):
        value = value.to_list()
    elif isinstance(value, str):
        try:
            value = ast.literal_eval(value)
        except (SyntaxError, ValueError) as exc:
            raise ValueError("fixture embedding is not a valid numeric vector") from exc
    elif hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (list, tuple)) or any(isinstance(item, (list, tuple)) for item in value):
        raise ValueError("fixture embedding must be a flat numeric sequence")
    if len(value) != DIMENSION:
        raise ValueError(f"fixture embedding dimension must equal {DIMENSION}, got {len(value)}")
    result: list[float] = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, (int, float)):
            raise ValueError("fixture embedding contains a non-numeric value")
        number = float(item)
        if not math.isfinite(number):
            raise ValueError("fixture embedding contains NaN or Infinity")
        result.append(number)
    return result


def registered_connection(database_url: str) -> psycopg.Connection:
    connection = psycopg.connect(database_url, row_factory=dict_row)
    try:
        register_vector(connection)
    except Exception:
        connection.close()
        raise
    return connection


class StaticProvider:
    def __init__(self, vector: list[float]):
        self.vector = vector
        self.calls = 0

    def embed_query(self, _query: str) -> list[float]:
        self.calls += 1
        return list(self.vector)


class StableReranker:
    """Acceptance reranker that preserves candidate identity and adds real metadata."""
    def rerank(self, _query: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [dict(row, reranker_rank=index, reranker_score=1.0 / index)
                for index, row in enumerate(rows, 1)]


@dataclass
class FixtureIds:
    organizations: list[str]
    users: list[str]
    documents: list[str]
    chunks: list[int]
    embeddings: list[str]
    page_texts: list[str]


def _database_url() -> str:
    value = os.getenv("DATABASE_URL") or dotenv_values(Path(__file__).parents[1] / ".env").get("DATABASE_URL")
    if not value:
        pytest.fail("LIVE_ACCEPTANCE_DATABASE_URL_MISSING")
    return str(value)


def _fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _snapshot(cursor) -> dict[str, tuple[int, str]]:
    result = {}
    for table in ("documents", "document_page_texts", "document_content_blocks", "document_chunks",
                  "document_chunk_embeddings", "rag_observability_events"):
        cursor.execute("SELECT to_regclass(%s) name", (f"public.{table}",))
        if cursor.fetchone()["name"] is None:
            continue
        cursor.execute(f"SELECT count(*) count, coalesce(md5(string_agg(row_text, '' ORDER BY row_text)), md5('')) digest "
                       f"FROM (SELECT row_to_json(t)::text row_text FROM {table} t) rows")
        row = cursor.fetchone()
        result[table] = (int(row["count"]), row["digest"])
    return result


def _cleanup(database_url: str, ids: FixtureIds) -> None:
    with registered_connection(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM rag_observability_events WHERE organization_id=ANY(%s::uuid[])",
                           (ids.organizations,))
            cursor.execute("DELETE FROM document_chunk_embeddings WHERE organization_id=ANY(%s::uuid[])",
                           (ids.organizations,))
            cursor.execute("DELETE FROM document_chunks WHERE organization_id=ANY(%s::uuid[])", (ids.organizations,))
            cursor.execute("DELETE FROM document_content_blocks WHERE organization_id=ANY(%s::uuid[])",
                           (ids.organizations,))
            cursor.execute("DELETE FROM document_page_texts WHERE organization_id=ANY(%s::uuid[])",
                           (ids.organizations,))
            cursor.execute("DELETE FROM documents WHERE organization_id=ANY(%s::uuid[])", (ids.organizations,))
            cursor.execute("DELETE FROM users WHERE organization_id=ANY(%s::uuid[])", (ids.organizations,))
            cursor.execute("DELETE FROM organizations WHERE id=ANY(%s::uuid[])", (ids.organizations,))


def _persist_live_terminal(database_url: str, organization_id: str, user_id: str,
                           event_key: str, diagnostics: dict[str, Any]) -> None:
    node_project = Path(__file__).resolve().parents[3] / "nodeJs Setup"
    script = """
const {ObservabilityWriter}=require('./src/Modules/observability/observability.writer');
const value=JSON.parse(process.env.RETRIEVAL_ACCEPTANCE_PAYLOAD);
ObservabilityWriter.terminal(value).then(()=>process.exit(0));
"""
    payload = {"org": organization_id, "user": user_id, "eventKey": event_key, "request": event_key,
               "mode": "SYNC", "status": "COMPLETED", "body": {"provider": "live-acceptance",
               "model": "live-acceptance", "answer_status": "INSUFFICIENT_EVIDENCE",
               "retrieval": {"retrieved_count": diagnostics["finalEvidenceCount"],
               "selected_evidence_count": diagnostics["finalEvidenceCount"], "diagnostics": diagnostics}}}
    environment = {**os.environ, "DATABASE_URL": database_url,
                   "RETRIEVAL_ACCEPTANCE_PAYLOAD": json.dumps(payload, separators=(",", ":"))}
    subprocess.run(["node", "-r", "dotenv/config", "-r", "ts-node/register", "-e", script],
                   cwd=node_project, env=environment, check=True, capture_output=True, text=True, timeout=60)


def test_vector_text_is_parsed_numerically() -> None:
    vector = validated_vector("[" + ",".join(["0.0"] * DIMENSION) + "]")
    assert len(vector) == DIMENSION and all(isinstance(value, float) for value in vector)


@pytest.mark.parametrize("value,message", [
    ([0.0] * 383, "dimension"),
    ([0.0] * 383 + ["x"], "non-numeric"),
    ([0.0] * 383 + [float("nan")], "NaN"),
    ([0.0] * 383 + [float("inf")], "NaN"),
    ([[0.0]] * DIMENSION, "flat"),
])
def test_invalid_fixture_vectors_are_rejected(value: Any, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        validated_vector(value)


def test_live_four_mode_tenant_acceptance() -> None:
    database_url = _database_url()
    ids = FixtureIds(
        organizations=[str(uuid.uuid4()), str(uuid.uuid4())],
        users=[str(uuid.uuid4()), str(uuid.uuid4())],
        documents=[str(uuid.uuid4()) for _ in range(4)],
        chunks=[], embeddings=[], page_texts=[],
    )
    before: dict[str, tuple[int, str]] | None = None
    config: EmbeddingConfiguration | None = None
    source_vector: list[float] | None = None
    org_a, org_b = ids.organizations
    doc_a1, doc_a2, doc_deleted, doc_b = ids.documents
    try:
        with registered_connection(database_url) as connection:
            with connection.cursor() as cursor:
                before = _snapshot(cursor)
                cursor.execute("""SELECT embedding,embedding_provider,embedding_model,embedding_model_revision,
                                  embedding_dimension,normalized FROM document_chunk_embeddings
                                  WHERE embedding_dimension=%s ORDER BY created_at,id LIMIT 1""", (DIMENSION,))
                source = cursor.fetchone()
                assert source is not None, "LIVE_ACCEPTANCE_NO_PRODUCTION_SHAPED_EMBEDDING"
                source_vector = validated_vector(source["embedding"])
                config = EmbeddingConfiguration(
                    provider=source["embedding_provider"], model=source["embedding_model"],
                    model_revision=source["embedding_model_revision"], dimension=DIMENSION,
                    normalize=source["normalized"],
                )
                # The persisted fingerprint is authoritative; mirror its configuration metadata.
                cursor.execute("SELECT embedding_configuration_fingerprint FROM document_chunk_embeddings "
                               "WHERE embedding_dimension=%s ORDER BY created_at,id LIMIT 1", (DIMENSION,))
                persisted_fingerprint = cursor.fetchone()["embedding_configuration_fingerprint"].strip()
                object.__setattr__(config, "_acceptance_fingerprint", persisted_fingerprint)

                for org, user, suffix in ((org_a, ids.users[0], "a"), (org_b, ids.users[1], "b")):
                    cursor.execute("INSERT INTO organizations(id,name,slug) VALUES(%s,%s,%s)",
                                   (org, f"{MARKER}-{suffix}", f"{MARKER.lower()}-{uuid.uuid4()}"))
                    cursor.execute("INSERT INTO users(id,organization_id,email,full_name,role,password_hash) "
                                   "VALUES(%s,%s,%s,%s,'ADMIN',%s)",
                                   (user, org, f"{uuid.uuid4().hex[:20]}@invalid.test", MARKER, "acceptance-not-a-login"))

                documents = (
                    (doc_a1, org_a, ids.users[0], "Tenant A semantic", None),
                    (doc_a2, org_a, ids.users[0], "Tenant A invoice", None),
                    (doc_deleted, org_a, ids.users[0], "Tenant A deleted", "NOW()"),
                    (doc_b, org_b, ids.users[1], "Tenant B overlap", None),
                )
                for doc, org, owner, title, deleted in documents:
                    cursor.execute("""INSERT INTO documents(id,organization_id,owner_user_id,title,storage_key,
                                      content_hash,status,processing_stage,original_file_name,deleted_at)
                                      VALUES(%s,%s,%s,%s,%s,%s,'COMPLETED','RETRIEVAL_READY',%s,
                                      CASE WHEN %s THEN NOW() ELSE NULL END)""",
                                   (doc, org, owner, title, f"{MARKER}/{doc}", _fingerprint(doc),
                                    f"{title}.pdf", deleted is not None))

                chunks = (
                    (org_a, doc_a1, "The warehouse received forty-six units although the shipment manifest expected forty-eight.", 1),
                    (org_a, doc_a2, "Invoice reference ACME-INV-77821 has a payable total of ₹45,814.94 dated 12 March 2026.", 2),
                    (org_a, doc_deleted, "SECRET-TENANT-A-DELETED-9988", 3),
                    (org_b, doc_b, "The warehouse received forty-six units although the shipment manifest expected forty-eight. "
                                      "Invoice reference ACME-INV-77821 has a payable total of ₹45,814.94 dated 12 March 2026. "
                                      "UNIQUE-TENANT-B-MARKER-4411", 4),
                )
                for org, doc, content, page in chunks:
                    block_id = str(uuid.uuid4())
                    page_text_id = str(uuid.uuid4()); ids.page_texts.append(page_text_id)
                    cursor.execute("""INSERT INTO document_page_texts
                                      (id,organization_id,document_id,page_number,text,text_length,extraction_method)
                                      VALUES(%s,%s,%s,%s,%s,%s,'ACCEPTANCE')""",
                                   (page_text_id, org, doc, page, content, len(content)))
                    cursor.execute("""INSERT INTO document_content_blocks
                                      (id,organization_id,document_id,page_number,block_order,block_type,source_type,
                                       page_text_id,content_text,readable_text,extraction_method,metadata)
                                      VALUES(%s,%s,%s,%s,0,'TEXT','DOCUMENT_PAGE_TEXT',%s,%s,%s,'ACCEPTANCE','{}')""",
                                   (block_id, org, doc, page, page_text_id, content, content))
                    fingerprint = _fingerprint(content)
                    cursor.execute("""INSERT INTO document_chunks
                                      (organization_id,document_id,chunk_index,content,chunk_text,cleaned_text,
                                       token_count,embedding_model,page_start,page_end,char_count,chunk_type,metadata,
                                       embedding_status,source_pages,content_types,source_block_ids,content_fingerprint)
                                      VALUES(%s,%s,0,%s,%s,%s,%s,%s,%s,%s,%s,'TEXT','{}','COMPLETED',%s,%s,%s,%s)
                                      RETURNING id""",
                                   (org, doc, content, content, content, len(content.split()), config.model,
                                    page, page, len(content), [page], ["TEXT"], [block_id], fingerprint))
                    chunk_id = int(cursor.fetchone()["id"]); ids.chunks.append(chunk_id)
                    embedding_id = str(uuid.uuid4()); ids.embeddings.append(embedding_id)
                    cursor.execute("""INSERT INTO document_chunk_embeddings
                                      (id,organization_id,document_id,chunk_id,chunk_index,content_fingerprint,
                                       source_pages,embedding_provider,embedding_model,embedding_model_revision,
                                       embedding_dimension,embedding_configuration_fingerprint,embedding,normalized,
                                       generation_duration_ms,embedding_attempt,source_token_count)
                                      VALUES(%s,%s,%s,%s,0,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,1,%s)""",
                                   (embedding_id, org, doc, chunk_id, fingerprint, [page], config.provider,
                                    config.model, config.model_revision, DIMENSION, persisted_fingerprint,
                                    Vector(source_vector), config.normalize, len(content.split())))

                cursor.execute("SELECT embedding,vector_dims(embedding) dims, embedding <=> %s distance "
                               "FROM document_chunk_embeddings WHERE id=%s", (Vector(source_vector), ids.embeddings[0]))
                proof = cursor.fetchone()
                assert len(validated_vector(proof["embedding"])) == DIMENSION
                assert proof["dims"] == DIMENSION and float(proof["distance"]) == pytest.approx(0.0, abs=1e-9)

        assert config is not None and source_vector is not None
        # Use the exact persisted configuration fingerprint without changing production code.
        class AcceptanceConfiguration(EmbeddingConfiguration):
            @property
            def fingerprint(self) -> str:
                return persisted_fingerprint
        config = AcceptanceConfiguration(**{key: getattr(config, key) for key in config.__dataclass_fields__})
        provider = StaticProvider(source_vector)
        cache = QueryEmbeddingCache(enabled=True, max_entries=100, ttl_seconds=300)
        service = RetrievalService(
            repository=PgVectorRetrievalRepository(database_url), provider=provider, configuration=config,
            query_cache=cache, reranker=StableReranker(),
            hybrid_configuration=HybridConfiguration(vector_candidate_k=20, lexical_candidate_k=20,
                fusion_candidate_k=20, rerank_candidate_k=20, final_top_k=10),
        )

        queries_a = (
            "warehouse received forty-six units shipment manifest forty-eight",
            "ACME-INV-77821", "₹45,814.94", "SECRET-TENANT-A-DELETED-9988",
            "UNIQUE-TENANT-B-MARKER-4411",
        )
        queries_b = (queries_a[0], queries_a[1], queries_a[2], "UNIQUE-TENANT-B-MARKER-4411")
        seen_results: dict[tuple[str, str, str], list[int]] = {}
        for org, allowed, forbidden, queries in (
            (org_a, {doc_a1, doc_a2}, {doc_b, doc_deleted}, queries_a),
            (org_b, {doc_b}, {doc_a1, doc_a2, doc_deleted}, queries_b),
        ):
            for mode in MODES:
                for query in queries:
                    response = service.search(RetrievalRequest(org, query, 10, -1.0, [], True, mode))
                    assert response["requested_retrieval_mode"] == mode
                    assert response["effective_retrieval_mode"] == mode
                    diagnostics = response["retrieval_diagnostics"]
                    assert diagnostics["requestedMode"] == mode and diagnostics["effectiveMode"] == mode
                    assert diagnostics["finalEvidenceCount"] == len(response["results"])
                    assert diagnostics["totalRetrievalMs"] is not None
                    assert "query" not in diagnostics and "content" not in diagnostics and "evidence" not in diagnostics
                    results = response["results"]
                    assert all(item["document_id"] in allowed for item in results)
                    assert not ({item["document_id"] for item in results} & forbidden)
                    assert all(item["chunk_id"] in ids.chunks for item in results)
                    assert all(item["page_start"] > 0 and item["chunk_index"] >= 0 for item in results)
                    assert all(evidence["content_block_id"] in item["source_block_ids"]
                               for item in results for evidence in item["evidence"])
                    assert response["duplicate_suppression_count"] >= 0
                    seen_results[(org, mode, query)] = [item["chunk_id"] for item in results]

        # Cache replay: identical cross-tenant query cannot share final results; same-tenant replay is stable.
        replay_query = queries_a[1]
        assert set(seen_results[(org_a, "HYBRID_RERANK", replay_query)]).isdisjoint(
            seen_results[(org_b, "HYBRID_RERANK", replay_query)])
        replay = service.search(RetrievalRequest(org_a, replay_query, 10, -1.0, [], True, "HYBRID_RERANK"))
        assert [item["chunk_id"] for item in replay["results"]] == seen_results[(org_a, "HYBRID_RERANK", replay_query)]
        assert replay["cache_hit"] is True

        event_key = f"{MARKER}-{uuid.uuid4()}"
        _persist_live_terminal(database_url, org_a, ids.users[0], event_key, replay["retrieval_diagnostics"])
        with registered_connection(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT metadata FROM rag_observability_events WHERE organization_id=%s AND event_key=%s",
                               (org_a, event_key))
                persisted = cursor.fetchone()["metadata"]
                assert persisted["retrieval"] == replay["retrieval_diagnostics"]
                assert not ({"query", "content", "evidence", "prompt", "answer", "vector"} & set(persisted["retrieval"]))
        _persist_live_terminal(database_url, org_a, ids.users[0], event_key,
                               service.search(RetrievalRequest(org_a, "different replay", 10, -1.0, [], True, "VECTOR"))["retrieval_diagnostics"])
        with registered_connection(database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT count(*) count, (array_agg(metadata))[1] metadata FROM rag_observability_events WHERE organization_id=%s AND event_key=%s",
                               (org_a, event_key))
                event = cursor.fetchone(); assert event["count"] == 1 and event["metadata"] == persisted

        for org, foreign_doc in ((org_a, doc_b), (org_b, doc_a1)):
            for mode in MODES:
                with pytest.raises(RetrievalError) as error:
                    service.search(RetrievalRequest(org, "ACME-INV-77821", 10, -1.0,
                                                    [foreign_doc], True, mode))
                assert error.value.error_code == "RETRIEVAL_DOCUMENT_NOT_FOUND"
    finally:
        _cleanup(database_url, ids)

    with registered_connection(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""SELECT
                (SELECT count(*) FROM organizations WHERE id=ANY(%s::uuid[])) organizations,
                (SELECT count(*) FROM documents WHERE id=ANY(%s::uuid[])) documents,
                (SELECT count(*) FROM document_chunks WHERE id=ANY(%s::bigint[])) chunks,
                (SELECT count(*) FROM document_chunk_embeddings WHERE id=ANY(%s::uuid[])) embeddings""",
                           (ids.organizations, ids.documents, ids.chunks, ids.embeddings))
            assert set(cursor.fetchone().values()) == {0}
            assert _snapshot(cursor) == before
