-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
-- =============================================================================
-- Manuscript / bible chunks for the Librarian (HAL-adjacent semantic RAG). Embeddings: 1536 (text-embedding-3-small class).

CREATE TABLE IF NOT EXISTS public.p4_narrative_library_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_document TEXT NOT NULL,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('lore', 'plot', 'character')),
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  word_count INT NOT NULL DEFAULT 0,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p4_narrative_library_chunks_dedupe UNIQUE (tenant_id, source_document, chunk_type, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_p4_narrative_library_chunks_tenant_time
  ON public.p4_narrative_library_chunks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p4_narrative_library_chunks_source
  ON public.p4_narrative_library_chunks (tenant_id, source_document, chunk_type);

CREATE INDEX IF NOT EXISTS idx_p4_narrative_library_chunks_embedding
  ON public.p4_narrative_library_chunks
  USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE public.p4_narrative_library_chunks IS
  'Ingested manuscript/bible chunks (pgvector) for Librarian semantic search during HAL sessions.';

ALTER TABLE public.p4_narrative_library_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_p4_narrative_library_chunks" ON public.p4_narrative_library_chunks;
CREATE POLICY "tenant_select_p4_narrative_library_chunks"
ON public.p4_narrative_library_chunks
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "tenant_insert_p4_narrative_library_chunks" ON public.p4_narrative_library_chunks;
CREATE POLICY "tenant_insert_p4_narrative_library_chunks"
ON public.p4_narrative_library_chunks
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "tenant_update_p4_narrative_library_chunks" ON public.p4_narrative_library_chunks;
CREATE POLICY "tenant_update_p4_narrative_library_chunks"
ON public.p4_narrative_library_chunks
FOR UPDATE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
)
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "tenant_delete_p4_narrative_library_chunks" ON public.p4_narrative_library_chunks;
CREATE POLICY "tenant_delete_p4_narrative_library_chunks"
ON public.p4_narrative_library_chunks
FOR DELETE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);
