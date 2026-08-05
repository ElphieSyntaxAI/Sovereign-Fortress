-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
-- =============================================================================
-- Semantic search over ingested manuscript/bible chunks (1536-dim OpenAI-class embeddings).

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
    AND (
      p_chunk_types IS NULL
      OR cardinality(p_chunk_types) = 0
      OR c.chunk_type = ANY (p_chunk_types)
    )
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT LEAST(COALESCE(NULLIF(p_match_count, 0), 8), 50);
$$;

COMMENT ON FUNCTION public.match_p4_narrative_library_chunks IS
  'pgvector cosine distance retrieval for Lore Librarian (tenant-scoped).';

GRANT EXECUTE ON FUNCTION public.match_p4_narrative_library_chunks(UUID, vector(1536), INT, TEXT[])
TO service_role;

GRANT EXECUTE ON FUNCTION public.match_p4_narrative_library_chunks(UUID, vector(1536), INT, TEXT[])
TO authenticated;
