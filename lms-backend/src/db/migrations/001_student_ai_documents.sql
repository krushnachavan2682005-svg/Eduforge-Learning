-- Migration: Create Student AI Documents tables and setup pgvector
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    student_id UUID NOT NULL REFERENCES students(id),
    owner_user_id UUID NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'UPLOADED',
    processing_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_documents_org_student ON ai_documents(organization_id, student_id);
CREATE INDEX IF NOT EXISTS idx_ai_documents_org_student_id ON ai_documents(organization_id, student_id, id);

CREATE TABLE IF NOT EXISTS document_content_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    document_id UUID NOT NULL REFERENCES ai_documents(id),
    page_number INT NOT NULL,
    block_order INT NOT NULL,
    content_text TEXT,
    readable_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_content_blocks_org_doc ON document_content_blocks(organization_id, document_id, page_number, block_order);
CREATE INDEX IF NOT EXISTS idx_doc_content_blocks_doc ON document_content_blocks(document_id, page_number, block_order);

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    document_id UUID NOT NULL REFERENCES ai_documents(id),
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT NOT NULL,
    embedding_status TEXT NOT NULL DEFAULT 'PENDING',
    content_fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_chunks_idx ON document_chunks(organization_id, document_id, chunk_index);

CREATE TABLE IF NOT EXISTS document_chunk_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    document_id UUID NOT NULL REFERENCES ai_documents(id),
    chunk_id BIGINT NOT NULL REFERENCES document_chunks(id),
    chunk_index INT NOT NULL,
    content_fingerprint VARCHAR(64) NOT NULL,
    embedding VECTOR(384) NOT NULL,
    embedding_provider TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dimension INT NOT NULL DEFAULT 384,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_org_doc ON document_chunk_embeddings(organization_id, document_id);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_org_doc_chunk ON document_chunk_embeddings(organization_id, document_id, chunk_id);
