-- ============================================================
-- Phase 12.8 — Knowledge Base (Document Upload + RAG).
--
-- Tenants upload PDF/DOCX/TXT files. We parse, chunk, embed,
-- and store them. At call-start the prompt-builder retrieves
-- the top-K most-relevant chunks (by cosine similarity) and
-- injects them into the system prompt as `# Knowledge Base
-- Excerpts`, grounding the AI in tenant-specific facts.
--
-- Storage decisions for V1:
--   - File bytes live in Postgres `bytea` (capped at 10MB by
--     @fastify/multipart). Migrate to R2/S3 in 12.8.1 if needed.
--   - Embeddings via pgvector `vector(1536)` for
--     OpenAI text-embedding-3-small. embedding_model column
--     lets us migrate models later without losing comparability.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_bytes BYTEA NOT NULL,
  -- pending | processing | ready | failed
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS kb_documents_tenant_idx
  ON kb_documents(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS kb_documents_status_idx
  ON kb_documents(status)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  -- 1536 dims = OpenAI text-embedding-3-small.
  -- Nullable so chunks can be created before embeddings are computed.
  embedding vector(1536),
  -- Locks the model used so we can migrate later without losing comparability.
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-tenant retrieval: cosine-similarity over rows scoped to the tenant.
-- Partial index on rows that actually have embeddings; saves space during
-- the brief window between insert and embed.
CREATE INDEX IF NOT EXISTS kb_chunks_tenant_embedding_idx
  ON kb_chunks USING ivfflat (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS kb_chunks_document_idx
  ON kb_chunks(document_id, chunk_index);

COMMENT ON COLUMN kb_documents.file_bytes IS
  'Original uploaded file. V1 storage is in-row; migrate to object storage when total exceeds ~50GB.';
COMMENT ON COLUMN kb_chunks.embedding IS
  '1536-dim vector for OpenAI text-embedding-3-small. Cosine similarity used at retrieval.';
COMMENT ON COLUMN kb_chunks.embedding_model IS
  'Model used to compute this embedding. Required for safe future model migrations.';
