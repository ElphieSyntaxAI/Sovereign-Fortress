-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
-- =============================================================================
-- Unified Author Ecosystem + Syntax-Educates (schools) scaffold
-- Hybrid multi-tenant: authors in public (RLS + tenant_id UUID); schools in per-school schemas.
-- Outline / World Bible docs were not in-repo; layer names follow the 5-layer RAG stack you described.
-- Embeddings: populate in app code; dimensions match common OpenAI text-embedding-3-small (1536).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Profiles (subscription tiers + school admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authorship_tier TEXT CHECK (
    authorship_tier IS NULL
    OR authorship_tier IN ('T1', 'T2', 'T3', 'T4', 'T5')
  ),
  is_school_admin BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS authorship_tier TEXT,
  ADD COLUMN IF NOT EXISTS is_school_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_authorship_tier ON public.profiles (authorship_tier)
WHERE authorship_tier IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Layer 1 — Universal / planetary laws (RAG: planetary_laws_narrative)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  planetary_laws_narrative TEXT,
  planetary_laws_embedding vector (1536),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p4_environments_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_p4_environments_tenant ON public.p4_environments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_p4_environments_planetary_embedding ON public.p4_environments
  USING hnsw (planetary_laws_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Layer 2 — Spatial / POI laws (RAG: spatial + POI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  environment_id UUID NOT NULL REFERENCES public.p4_environments (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  spatial_laws_narrative TEXT,
  spatial_laws_embedding vector (1536),
  poi_laws_narrative TEXT,
  poi_laws_embedding vector (1536),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p4_settings_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_p4_settings_tenant ON public.p4_settings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_p4_settings_environment ON public.p4_settings (environment_id);
CREATE INDEX IF NOT EXISTS idx_p4_settings_spatial_embedding ON public.p4_settings
  USING hnsw (spatial_laws_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_p4_settings_poi_embedding ON public.p4_settings
  USING hnsw (poi_laws_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Layer 3 — Characters (main / side / no-name; RAG: archetype + portrait)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  setting_id UUID NOT NULL REFERENCES public.p4_settings (id) ON DELETE CASCADE,
  archetype_class TEXT NOT NULL CHECK (archetype_class IN ('main', 'side', 'no_name')),
  display_name TEXT NOT NULL,
  codename TEXT,
  archetype_rag_profile TEXT,
  archetype_embedding vector (1536),
  portrait_rag_notes TEXT,
  portrait_embedding vector (1536),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_characters_tenant ON public.p4_characters (tenant_id);
CREATE INDEX IF NOT EXISTS idx_p4_characters_setting ON public.p4_characters (setting_id);
CREATE INDEX IF NOT EXISTS idx_p4_characters_archetype_embedding ON public.p4_characters
  USING hnsw (archetype_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_p4_characters_portrait_embedding ON public.p4_characters
  USING hnsw (portrait_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Layer 4 — Plot / narrative roadmap (RAG: beat + detail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_plot_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  environment_id UUID REFERENCES public.p4_environments (id) ON DELETE SET NULL,
  setting_id UUID REFERENCES public.p4_settings (id) ON DELETE SET NULL,
  character_id UUID REFERENCES public.p4_characters (id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  roadmap_phase TEXT,
  beat_label TEXT,
  summary TEXT,
  narrative_detail_rag TEXT,
  narrative_detail_embedding vector (1536),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_plot_points_tenant ON public.p4_plot_points (tenant_id);
CREATE INDEX IF NOT EXISTS idx_p4_plot_points_env ON public.p4_plot_points (environment_id);
CREATE INDEX IF NOT EXISTS idx_p4_plot_points_setting ON public.p4_plot_points (setting_id);
CREATE INDEX IF NOT EXISTS idx_p4_plot_points_character ON public.p4_plot_points (character_id);
CREATE INDEX IF NOT EXISTS idx_p4_plot_points_detail_embedding ON public.p4_plot_points
  USING hnsw (narrative_detail_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Layer 5 — Active situation / scene + senses (RAG: scene + senses)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_situations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plot_point_id UUID NOT NULL REFERENCES public.p4_plot_points (id) ON DELETE CASCADE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  active_scene_narrative TEXT,
  active_scene_embedding vector (1536),
  senses_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  senses_rag_narrative TEXT,
  senses_embedding vector (1536),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_situations_tenant ON public.p4_situations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_p4_situations_plot_point ON public.p4_situations (plot_point_id);
CREATE INDEX IF NOT EXISTS idx_p4_situations_active ON public.p4_situations (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_p4_situations_scene_embedding ON public.p4_situations
  USING hnsw (active_scene_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_p4_situations_senses_embedding ON public.p4_situations
  USING hnsw (senses_embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- HAL ledger + narrative commits (public; tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_hal_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  author_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  keystroke_latency_ms INT[] NOT NULL DEFAULT ARRAY[]::INT[],
  manual_word_count INT NOT NULL DEFAULT 0,
  ai_assisted_word_count INT NOT NULL DEFAULT 0,
  stylometric_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_sample JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_hal_ledger_tenant_time ON public.p4_hal_ledger (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p4_hal_ledger_session ON public.p4_hal_ledger (session_id);

CREATE TABLE IF NOT EXISTS public.p4_narrative_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  parent_commit_id UUID REFERENCES public.p4_narrative_commits (id) ON DELETE SET NULL,
  chapter_label TEXT NOT NULL,
  committed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  world_bible_merge_summary TEXT,
  layer_entity_refs JSONB NOT NULL DEFAULT '{}'::JSONB,
  commit_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_narrative_commits_tenant_time ON public.p4_narrative_commits (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS (public author tables): align JWT user_metadata.tenant_id (text) with UUID rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_plot_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_situations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_hal_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_narrative_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/update own row
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR
SELECT TO authenticated USING (id = auth.uid ());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR
UPDATE TO authenticated USING (id = auth.uid ())
WITH CHECK (id = auth.uid ());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid ());

-- Tenant-scoped narrative stack + HAL (read/write when tenant matches)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
  SELECT unnest(
      ARRAY[
        'p4_environments',
        'p4_settings',
        'p4_characters',
        'p4_plot_points',
        'p4_situations',
        'p4_hal_ledger',
        'p4_narrative_commits'
      ]
    )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'tenant_select_' || t,
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        tenant_id::text = (auth.jwt() -> ''user_metadata'' ->> ''tenant_id'')
      )',
      'tenant_select_' || t,
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'tenant_insert_' || t,
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        tenant_id::text = (auth.jwt() -> ''user_metadata'' ->> ''tenant_id'')
      )',
      'tenant_insert_' || t,
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'tenant_update_' || t,
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (
        tenant_id::text = (auth.jwt() -> ''user_metadata'' ->> ''tenant_id'')
      ) WITH CHECK (
        tenant_id::text = (auth.jwt() -> ''user_metadata'' ->> ''tenant_id'')
      )',
      'tenant_update_' || t,
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'tenant_delete_' || t,
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
        tenant_id::text = (auth.jwt() -> ''user_metadata'' ->> ''tenant_id'')
      )',
      'tenant_delete_' || t,
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- School schema factory: clone 5-layer structure (no HAL/commits in school DB by default)
-- Application sets search_path to e.g. school_acme_001,public when serving a school portal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_school_isolation_unit (school_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sch TEXT;
BEGIN
  IF school_id IS NULL OR length(trim(school_id)) = 0 THEN
    RAISE EXCEPTION 'create_school_isolation_unit: school_id required';
  END IF;

  IF school_id !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'create_school_isolation_unit: school_id must be alphanumeric, underscore, or hyphen';
  END IF;

  sch := 'school_' || replace(lower(trim(school_id)), '-', '_');

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = sch) THEN
    RAISE EXCEPTION 'create_school_isolation_unit: schema % already exists', sch;
  END IF;

  EXECUTE format('CREATE SCHEMA %I', sch);

  -- Layer 1
  EXECUTE format(
    'CREATE TABLE %I.p4_environments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      planetary_laws_narrative TEXT,
      planetary_laws_embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT ''{}''::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT p4_environments_tenant_slug UNIQUE (tenant_id, slug)
    )',
    sch
  );

  EXECUTE format(
    'CREATE INDEX idx_p4_environments_tenant ON %I.p4_environments (tenant_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_environments_planetary_embedding ON %I.p4_environments
      USING hnsw (planetary_laws_embedding vector_cosine_ops)',
    sch
  );

  -- Layer 2
  EXECUTE format(
    'CREATE TABLE %I.p4_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      environment_id UUID NOT NULL REFERENCES %I.p4_environments(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      spatial_laws_narrative TEXT,
      spatial_laws_embedding vector(1536),
      poi_laws_narrative TEXT,
      poi_laws_embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT ''{}''::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT p4_settings_tenant_slug UNIQUE (tenant_id, slug)
    )',
    sch,
    sch
  );

  EXECUTE format(
    'CREATE INDEX idx_p4_settings_tenant ON %I.p4_settings (tenant_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_settings_environment ON %I.p4_settings (environment_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_settings_spatial_embedding ON %I.p4_settings
      USING hnsw (spatial_laws_embedding vector_cosine_ops)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_settings_poi_embedding ON %I.p4_settings
      USING hnsw (poi_laws_embedding vector_cosine_ops)',
    sch
  );

  -- Layer 3
  EXECUTE format(
    'CREATE TABLE %I.p4_characters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      setting_id UUID NOT NULL REFERENCES %I.p4_settings(id) ON DELETE CASCADE,
      archetype_class TEXT NOT NULL CHECK (archetype_class IN (''main'', ''side'', ''no_name'')),
      display_name TEXT NOT NULL,
      codename TEXT,
      archetype_rag_profile TEXT,
      archetype_embedding vector(1536),
      portrait_rag_notes TEXT,
      portrait_embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT ''{}''::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )',
    sch,
    sch
  );

  EXECUTE format(
    'CREATE INDEX idx_p4_characters_tenant ON %I.p4_characters (tenant_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_characters_setting ON %I.p4_characters (setting_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_characters_archetype_embedding ON %I.p4_characters
      USING hnsw (archetype_embedding vector_cosine_ops)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_characters_portrait_embedding ON %I.p4_characters
      USING hnsw (portrait_embedding vector_cosine_ops)',
    sch
  );

  -- Layer 4
  EXECUTE format(
    'CREATE TABLE %I.p4_plot_points (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      environment_id UUID REFERENCES %I.p4_environments(id) ON DELETE SET NULL,
      setting_id UUID REFERENCES %I.p4_settings(id) ON DELETE SET NULL,
      character_id UUID REFERENCES %I.p4_characters(id) ON DELETE SET NULL,
      sort_order INT NOT NULL DEFAULT 0,
      roadmap_phase TEXT,
      beat_label TEXT,
      summary TEXT,
      narrative_detail_rag TEXT,
      narrative_detail_embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT ''{}''::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )',
    sch,
    sch,
    sch,
    sch
  );

  EXECUTE format(
    'CREATE INDEX idx_p4_plot_points_tenant ON %I.p4_plot_points (tenant_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_plot_points_env ON %I.p4_plot_points (environment_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_plot_points_setting ON %I.p4_plot_points (setting_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_plot_points_character ON %I.p4_plot_points (character_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_plot_points_detail_embedding ON %I.p4_plot_points
      USING hnsw (narrative_detail_embedding vector_cosine_ops)',
    sch
  );

  -- Layer 5
  EXECUTE format(
    'CREATE TABLE %I.p4_situations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      plot_point_id UUID NOT NULL REFERENCES %I.p4_plot_points(id) ON DELETE CASCADE,
      label TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      active_scene_narrative TEXT,
      active_scene_embedding vector(1536),
      senses_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      senses_rag_narrative TEXT,
      senses_embedding vector(1536),
      metadata JSONB NOT NULL DEFAULT ''{}''::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )',
    sch,
    sch
  );

  EXECUTE format(
    'CREATE INDEX idx_p4_situations_tenant ON %I.p4_situations (tenant_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_situations_plot_point ON %I.p4_situations (plot_point_id)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_situations_active ON %I.p4_situations (tenant_id, is_active)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_situations_scene_embedding ON %I.p4_situations
      USING hnsw (active_scene_embedding vector_cosine_ops)',
    sch
  );
  EXECUTE format(
    'CREATE INDEX idx_p4_situations_senses_embedding ON %I.p4_situations
      USING hnsw (senses_embedding vector_cosine_ops)',
    sch
  );

  EXECUTE format('GRANT USAGE ON SCHEMA %I TO postgres, service_role', sch);
  EXECUTE format(
    'GRANT ALL ON ALL TABLES IN SCHEMA %I TO postgres, service_role',
    sch
  );
  EXECUTE format(
    'GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO postgres, service_role',
    sch
  );

  RETURN sch;
END;
$$;

REVOKE ALL ON FUNCTION public.create_school_isolation_unit (TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_school_isolation_unit (TEXT) TO service_role;

COMMENT ON FUNCTION public.create_school_isolation_unit (TEXT) IS
'Creates school_<sanitized_id> schema with cloned 5-layer tables; returns schema name. Use SET search_path for school sessions.';
