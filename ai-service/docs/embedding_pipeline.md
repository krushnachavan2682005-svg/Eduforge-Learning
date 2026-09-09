# Versioned chunk embedding pipeline

The V1 provider is `sentence_transformers` with `BAAI/bge-small-en-v1.5`, pinned to
revision `5c38ec7c405ec4b44b94cc5a9bb96e735b38267a`. It generates normalized
384-dimensional vectors on CPU by default. Only `document_chunks.content`, ordered
by tenant, document, and `chunk_index`, is embedded.

Model name, immutable revision, dimension, normalization, prefixes, pooling,
library version, and implementation version form a deterministic SHA-256
configuration fingerprint. Chunk content fingerprint plus this configuration
fingerprint drives idempotency and stale selection. Batches default to 32.

PostgreSQL must have the pgvector server extension installed and enabled before
migration 017 is applied. The Python `pgvector` dependency only supplies the
Psycopg adapter; it does not install the server extension.

Sequence:

1. Install pgvector server files for PostgreSQL 18.
2. Run `CREATE EXTENSION IF NOT EXISTS vector;` in `document_intelligence`.
3. Apply `017_add_document_chunk_embeddings.sql`.
4. Run `python -m app.embeddings.check_embedding_environment`.
5. Run `python -m app.embeddings.run_embeddings_for_document --organization-id ... --document-id ...`.

Production orchestration can dispatch an existing `EMBEDDING` processing job to
`POST /internal/jobs/embed-document`. This keeps upload/PDF processing independent
from local model inference and makes the embedding stage separately observable.

Inference occurs outside database transactions. Claims, each batch persistence,
status updates, and the final completeness transition use short transactions.
Failed batches remain retryable and do not delete earlier valid embeddings.
Stale `PROCESSING` claims are recovered after the configured timeout.

`RETRIEVAL_READY` is set only when every current chunk has a valid active-
configuration embedding and the document has at least one chunk. Similarity search
and retrieval integration intentionally belong to the next module.
