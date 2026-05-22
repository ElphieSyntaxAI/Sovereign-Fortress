-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
-- =============================================================================
-- =============================================================================
-- Syntax Education — Approved Materials Pipeline (masterdoc §4)
--
-- Adds:
--   * public.education_district_curriculum_catalog (P1 inventory — pillars §2.1.4)
--   * public.education_assignment_resources (P2 sliced binding — pillars §2.2.1)
--   * resource scope filter on public.match_education_curriculum_shards
--
-- Cross-tenant guardrail: catalog rows are bound to `district_tenant_id` and may
-- only be mutated by `admin` / `super_admin` roles for the same tenant.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.education_district_curriculum_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT,
  isbn TEXT,
  subject_domain TEXT NOT NULL DEFAULT 'general'
    CHECK (subject_domain IN ('ela', 'history', 'math', 'science', 'general')),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('local_pdf', 'local_epub', 'lti_publisher', 'clever', 'classlink')),
  storage_object_path TEXT,
  external_resource_url TEXT,
  lti_deployment_id UUID REFERENCES public.education_lti_deployments (id) ON DELETE SET NULL,
  /**
   * Structural layout (Units → Chapters → Sections → page arrays).
   * Shape (validated client-side; not enforced in SQL):
   *   [
   *     {
   *       "unitId": "u1", "unitTitle": "Unit 1 — Civics",
   *       "chapters": [
   *         {
   *           "chapterId": "c1", "chapterTitle": "Chapter 1 — Foundations",
   *           "sections": [
   *             { "sectionId": "s1", "sectionTitle": "1.1 The Constitution", "pageStart": 12, "pageEnd": 24 }
   *           ]
   *         }
   *       ]
   *     }
   *   ]
   */
  layout JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_page_count INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT education_curriculum_catalog_source_complete CHECK (
    (source_type IN ('local_pdf', 'local_epub') AND storage_object_path IS NOT NULL)
    OR (source_type IN ('lti_publisher', 'clever', 'classlink') AND external_resource_url IS NOT NULL)
  )
);

COMMENT ON TABLE public.education_district_curriculum_catalog IS
  'P1 inventory — admin-approved curriculum titles per district_tenant_id (pillars §2.1.4).';

CREATE INDEX IF NOT EXISTS idx_education_curriculum_catalog_tenant_active
  ON public.education_district_curriculum_catalog (district_tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_education_curriculum_catalog_subject
  ON public.education_district_curriculum_catalog (district_tenant_id, subject_domain);

-- -----------------------------------------------------------------------------
-- Assignment slice (junction) — masterdoc §4.2 + pillars §2.2.1
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.education_assignment_resources (
  /** `resource_context_id` — sent to Socratic Tutor + workspace canvas. */
  resource_context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  assignment_id UUID NOT NULL,
  catalog_id UUID NOT NULL
    REFERENCES public.education_district_curriculum_catalog (id) ON DELETE RESTRICT,
  /**
   * Teacher-selected slice — a sparse subset of the catalog `layout` tree.
   * Shape:
   *   {
   *     "unitIds": ["u1"],
   *     "chapterIds": ["u1.c4"],
   *     "sectionIds": ["u1.c4.s2"],
   *     "pageStart": 87,
   *     "pageEnd": 102
   *   }
   * The RAG RPC matches shards whose metadata.resource_scope matches any of these tiers.
   */
  slice JSONB NOT NULL DEFAULT '{}'::JSONB,
  page_start INT,
  page_end INT,
  signed_deep_link TEXT,
  signed_deep_link_expires_at TIMESTAMPTZ,
  require_reading_block BOOLEAN NOT NULL DEFAULT FALSE,
  min_focus_block_ms INT NOT NULL DEFAULT 120000
    CHECK (min_focus_block_ms BETWEEN 0 AND 1800000),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT education_assignment_resources_unique UNIQUE (assignment_id, catalog_id)
);

COMMENT ON TABLE public.education_assignment_resources IS
  'P2 sliced binding — teacher-chopped sub-tree of a catalog title, addressed by resource_context_id (pillars §2.2.1).';

CREATE INDEX IF NOT EXISTS idx_education_assignment_resources_assignment
  ON public.education_assignment_resources (assignment_id);

CREATE INDEX IF NOT EXISTS idx_education_assignment_resources_tenant
  ON public.education_assignment_resources (tenant_id);

-- -----------------------------------------------------------------------------
-- RLS — cross-tenant guardrail
-- -----------------------------------------------------------------------------

ALTER TABLE public.education_district_curriculum_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_assignment_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education_catalog_service_role_all"
  ON public.education_district_curriculum_catalog;
CREATE POLICY "education_catalog_service_role_all"
  ON public.education_district_curriculum_catalog FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "education_catalog_authenticated_read"
  ON public.education_district_curriculum_catalog;
CREATE POLICY "education_catalog_authenticated_read"
  ON public.education_district_curriculum_catalog FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    AND district_tenant_id = COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'tenant_id',
      auth.jwt() -> 'app_metadata' ->> 'tenant_id'
    )
  );

DROP POLICY IF EXISTS "education_assignment_resources_service_role_all"
  ON public.education_assignment_resources;
CREATE POLICY "education_assignment_resources_service_role_all"
  ON public.education_assignment_resources FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "education_assignment_resources_authenticated_read"
  ON public.education_assignment_resources;
CREATE POLICY "education_assignment_resources_authenticated_read"
  ON public.education_assignment_resources FOR SELECT TO authenticated
  USING (
    tenant_id = COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'tenant_id',
      auth.jwt() -> 'app_metadata' ->> 'tenant_id'
    )
  );

REVOKE ALL ON public.education_district_curriculum_catalog FROM PUBLIC, anon;
REVOKE ALL ON public.education_assignment_resources FROM PUBLIC, anon;

GRANT SELECT ON public.education_district_curriculum_catalog TO authenticated;
GRANT SELECT ON public.education_assignment_resources TO authenticated;
GRANT ALL ON public.education_district_curriculum_catalog TO service_role;
GRANT ALL ON public.education_assignment_resources TO service_role;

-- -----------------------------------------------------------------------------
-- Resource-scoped curriculum shard RPC (Socratic Boundary Sync — masterdoc §4.3)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.match_education_curriculum_shards(
  TEXT, vector(1536), INT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.match_education_curriculum_shards(
  p_tenant_id TEXT,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 6,
  p_level_1_category TEXT DEFAULT NULL,
  p_level_1_1_branch TEXT DEFAULT NULL,
  p_level_1_1_1_instance TEXT DEFAULT NULL,
  /**
   * Resource scope filter — masterdoc §4.3 Socratic Boundary Sync.
   * Any of these (when non-NULL) tighten the search to shards tagged via the resource_context_id
   * the teacher picked in the slicing widget.
   */
  p_resource_context_id UUID DEFAULT NULL,
  p_catalog_id UUID DEFAULT NULL,
  p_allowed_unit_ids TEXT[] DEFAULT NULL,
  p_allowed_chapter_ids TEXT[] DEFAULT NULL,
  p_allowed_section_ids TEXT[] DEFAULT NULL,
  p_page_start INT DEFAULT NULL,
  p_page_end INT DEFAULT NULL
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
    -- Resource scope (Socratic Boundary Sync) -----------------------------
    AND (
      p_resource_context_id IS NULL
      OR v.metadata->'resource_scope'->>'resource_context_id' = p_resource_context_id::TEXT
    )
    AND (
      p_catalog_id IS NULL
      OR v.metadata->'resource_scope'->>'catalog_id' = p_catalog_id::TEXT
    )
    AND (
      p_allowed_unit_ids IS NULL
      OR v.metadata->'resource_scope'->>'unit_id' = ANY (p_allowed_unit_ids)
    )
    AND (
      p_allowed_chapter_ids IS NULL
      OR v.metadata->'resource_scope'->>'chapter_id' = ANY (p_allowed_chapter_ids)
    )
    AND (
      p_allowed_section_ids IS NULL
      OR v.metadata->'resource_scope'->>'section_id' = ANY (p_allowed_section_ids)
    )
    AND (
      p_page_start IS NULL
      OR COALESCE((v.metadata->'resource_scope'->>'page_end')::INT, 0) >= p_page_start
    )
    AND (
      p_page_end IS NULL
      OR COALESCE((v.metadata->'resource_scope'->>'page_start')::INT, 9999999) <= p_page_end
    )
  ORDER BY v.embedding <=> p_query_embedding
  LIMIT LEAST(COALESCE(NULLIF(p_match_count, 0), 6), 24);
$$;

COMMENT ON FUNCTION public.match_education_curriculum_shards IS
  'Tenant-scoped curriculum shard retrieval (P6) with optional 1.1.1 + resource_context_id slice filters (masterdoc §4.3).';

GRANT EXECUTE ON FUNCTION public.match_education_curriculum_shards(
  TEXT, vector(1536), INT, TEXT, TEXT, TEXT,
  UUID, UUID, TEXT[], TEXT[], TEXT[], INT, INT
) TO service_role, authenticated;

-- -----------------------------------------------------------------------------
-- Friction-gap recommendation engine (masterdoc §4.1)
--   Aggregates Hall (negative-index) hotspots per tenant so the admin catalog UI can
--   tag titles whose metadata keywords overlap with the active friction concepts.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.education_district_friction_hotspots(
  p_district_tenant_id TEXT,
  p_lookback_days INT DEFAULT 30,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  level_1_category TEXT,
  level_1_1_branch TEXT,
  level_1_1_1_instance TEXT,
  incident_count BIGINT,
  last_seen TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
  SELECT
    metadata->'bug_index'->>'level_1_category' AS level_1_category,
    metadata->'bug_index'->>'level_1_1_branch' AS level_1_1_branch,
    metadata->'bug_index'->>'level_1_1_1_instance' AS level_1_1_1_instance,
    COUNT(*)::BIGINT AS incident_count,
    MAX(created_at) AS last_seen
  FROM public.p4_narrative_logs
  WHERE tenant_id::text = p_district_tenant_id
    AND metadata->>'ledger' = 'hall'
    AND created_at >= NOW() - (GREATEST(p_lookback_days, 1) || ' days')::INTERVAL
  GROUP BY 1, 2, 3
  ORDER BY incident_count DESC, last_seen DESC
  LIMIT LEAST(COALESCE(NULLIF(p_limit, 0), 10), 50);
$$;

COMMENT ON FUNCTION public.education_district_friction_hotspots IS
  'P6 → admin recommendation engine — top 1.1.1 Hall instances per district (masterdoc §4.1).';

GRANT EXECUTE ON FUNCTION public.education_district_friction_hotspots(TEXT, INT, INT)
  TO service_role, authenticated;
