-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
-- =============================================================================
-- =============================================================================
-- Soft-delete column for p4_narrative_library_chunks + RPC filter.
-- Bridges wiki scrap/restore and unified chunk remove API.

ALTER TABLE public.p4_narrative_library_chunks
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_p4_narrative_library_chunks_active
  ON public.p4_narrative_library_chunks (tenant_id, chunk_type)
  WHERE is_deleted = false;

DROP INDEX IF EXISTS public.idx_p4_chunks_active_rag;

CREATE INDEX IF NOT EXISTS idx_p4_chunks_active_rag
  ON public.p4_narrative_library_chunks (tenant_id, chunk_type)
  WHERE is_deleted = false
    AND (metadata->>'rag_excluded_at') IS NULL
    AND COALESCE(metadata->'chunk_feedback'->>'reported', 'false') <> 'true'
    AND (metadata->>'wiki_scrapped_at') IS NULL;

CREATE OR REPLACE FUNCTION public.match_p4_narrative_library_chunks(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 8,
  p_chunk_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_document TEXT,
  chunk_type TEXT,
  chunk_index INT,
  metadata JSONB,
  cosine_similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
  SELECT
    c.id,
    c.content,
    c.source_document,
    c.chunk_type,
    c.chunk_index,
    c.metadata,
    (1 - (c.embedding <=> p_query_embedding))::DOUBLE PRECISION AS cosine_similarity
  FROM public.p4_narrative_library_chunks c
  WHERE c.tenant_id = p_tenant_id
    AND c.is_deleted = false
    AND (c.metadata->>'rag_excluded_at') IS NULL
    AND COALESCE(c.metadata->'chunk_feedback'->>'reported', 'false') <> 'true'
    AND (c.metadata->>'wiki_scrapped_at') IS NULL
    AND (
      p_chunk_types IS NULL
      OR cardinality(p_chunk_types) = 0
      OR c.chunk_type = ANY (p_chunk_types)
    )
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT LEAST(COALESCE(NULLIF(p_match_count, 0), 8), 50);
$$;

COMMENT ON FUNCTION public.match_p4_narrative_library_chunks IS
  'pgvector cosine retrieval for Lore Librarian; excludes is_deleted and soft-reported RAG shards.';

GRANT EXECUTE ON FUNCTION public.match_p4_narrative_library_chunks(UUID, vector(1536), INT, TEXT[])
TO service_role;

GRANT EXECUTE ON FUNCTION public.match_p4_narrative_library_chunks(UUID, vector(1536), INT, TEXT[])
TO authenticated;
