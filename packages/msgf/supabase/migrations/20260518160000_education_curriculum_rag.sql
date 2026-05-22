-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
-- =============================================================================
-- =============================================================================
-- Syntax Education — pgvector RAG over pillar_vectors (curriculum shards + Vault strengths)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.match_education_curriculum_shards(
  p_tenant_id TEXT,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 6,
  p_level_1_category TEXT DEFAULT NULL,
  p_level_1_1_branch TEXT DEFAULT NULL,
  p_level_1_1_1_instance TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  metadata JSONB,
  cosine_similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
  SELECT
    v.id::text,
    v.content,
    v.metadata,
    (1 - (v.embedding <=> p_query_embedding))::DOUBLE PRECISION AS cosine_similarity
  FROM public.pillar_vectors v
  WHERE v.embedding IS NOT NULL
    AND v.metadata->>'tenant_id' = p_tenant_id
    AND v.metadata->>'pillar' = 'P6'
    AND v.metadata->>'index_type' = 'curriculum_shard'
    AND (
      p_level_1_category IS NULL
      OR v.metadata->'bug_index'->>'level_1_category' = p_level_1_category
    )
    AND (
      p_level_1_1_branch IS NULL
      OR v.metadata->'bug_index'->>'level_1_1_branch' = p_level_1_1_branch
    )
    AND (
      p_level_1_1_1_instance IS NULL
      OR v.metadata->'bug_index'->>'level_1_1_1_instance' = p_level_1_1_1_instance
    )
  ORDER BY v.embedding <=> p_query_embedding
  LIMIT LEAST(COALESCE(NULLIF(p_match_count, 0), 6), 24);
$$;

COMMENT ON FUNCTION public.match_education_curriculum_shards IS
  'Tenant-scoped curriculum shard retrieval (P6 cold layer, 1.1.1 genealogical filters).';

CREATE OR REPLACE FUNCTION public.match_student_vault_strengths(
  p_tenant_id TEXT,
  p_entity_id TEXT,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 5,
  p_subject_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  metadata JSONB,
  cosine_similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
  SELECT
    v.id::text,
    v.content,
    v.metadata,
    (1 - (v.embedding <=> p_query_embedding))::DOUBLE PRECISION AS cosine_similarity
  FROM public.pillar_vectors v
  WHERE v.embedding IS NOT NULL
    AND v.metadata->>'tenant_id' = p_tenant_id
    AND v.metadata->>'pillar' = 'P6'
    AND (
      v.metadata->>'index_type' = 'student_strength'
      OR (
        v.metadata->>'ledger' = 'vault'
        AND v.metadata->>'index_type' = 'genealogical_bug_index'
        AND COALESCE((v.metadata->>'hal_score')::DOUBLE PRECISION, 0) >= 70
      )
    )
    AND (
      v.metadata->>'entity_id' = p_entity_id
      OR v.metadata->>'author_id' = p_entity_id
    )
    AND (
      p_subject_domain IS NULL
      OR v.metadata->>'subject_domain' = p_subject_domain
    )
  ORDER BY v.embedding <=> p_query_embedding
  LIMIT LEAST(COALESCE(NULLIF(p_match_count, 0), 5), 16);
$$;

COMMENT ON FUNCTION public.match_student_vault_strengths IS
  'Positive Vault index — student historic strengths for Socratic scaffolding.';

GRANT EXECUTE ON FUNCTION public.match_education_curriculum_shards(TEXT, vector(1536), INT, TEXT, TEXT, TEXT)
  TO service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.match_student_vault_strengths(TEXT, TEXT, vector(1536), INT, TEXT)
  TO service_role, authenticated;
