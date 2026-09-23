-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
-- =============================================================================
-- Legacy Express stack (port 3003): RAG + HUD + local-auth tables live on Supabase Postgres.
-- Rules for RAG validation / HUD limits are canonical in `public.msgf_rules` (namespace `rag`).
-- Connect the legacy app with DATABASE_URL (direct Postgres); Docker-era DB_* + schema.sql were removed.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- msgf_rules (MSGF policy payloads; RAG route reads namespace `rag`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.msgf_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_namespace TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msgf_rules_namespace_key UNIQUE (rule_namespace, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_msgf_rules_namespace ON public.msgf_rules (rule_namespace);

INSERT INTO public.msgf_rules (rule_namespace, rule_key, payload) VALUES
(
  'rag',
  'source_types',
  '[
    "world_bible",
    "world_as_character",
    "character_sheet",
    "story_outline",
    "theme_sheet",
    "trope_sensitivity_sheet",
    "parallel_arc_sheet"
  ]'::jsonb
),
(
  'rag',
  'author_only_source_types',
  '[
    "story_outline",
    "theme_sheet",
    "trope_sensitivity_sheet",
    "parallel_arc_sheet",
    "world_as_character"
  ]'::jsonb
),
(
  'rag',
  'plot_point_order_default',
  '{
    "hook": 1,
    "inciting_incident": 2,
    "internal_pivot": 3,
    "point_of_no_return": 4,
    "midpoint": 5,
    "deepdive_aha": 6,
    "climax": 7,
    "twist": 8,
    "resolution": 9,
    "parallel_arc": 10,
    "not_applicable": 0
  }'::jsonb
),
('rag', 'hud_min_words', '25'::jsonb),
('rag', 'hud_max_words', '40'::jsonb),
('rag', 'warning_max_words', '80'::jsonb),
('rag', 'rag_master_limit', '8'::jsonb)
ON CONFLICT (rule_namespace, rule_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- msgf_legacy_tiers / users / domains / tenants / profiles / projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.msgf_legacy_tiers (
  tier_id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  max_storage_mb INTEGER NOT NULL DEFAULT 0,
  can_use_lore_bot BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_strategy_ai BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_custom_domain BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.msgf_legacy_tiers (
  name,
  description,
  price_monthly,
  max_storage_mb,
  can_use_lore_bot,
  can_use_strategy_ai,
  can_use_custom_domain
) VALUES
(
  'Tier 1: Fan Access',
  'Grants basic access to interactive content, fan tools, and the Persona Bot chat.',
  2.99,
  0,
  FALSE,
  FALSE,
  FALSE
),
(
  'Tier 2: Core Author',
  'Access to core business features including Progress Tracking, Basic Analytics, and Social Automation.',
  19.99,
  1024,
  FALSE,
  FALSE,
  FALSE
),
(
  'Tier 3: Premium Author',
  'Full access to all features, including advanced analytics, Lore Guardian Bot, and custom domains.',
  49.99,
  5120,
  TRUE,
  TRUE,
  TRUE
)
ON CONFLICT (name) DO NOTHING;

-- p4_profiles.tier_id FK (p4_profiles is created before msgf_legacy_tiers in 20260514140000).
DO $$
BEGIN
  IF to_regclass('public.p4_profiles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'p4_profiles_tier_id_fkey'
     ) THEN
    ALTER TABLE public.p4_profiles
      ADD CONSTRAINT p4_profiles_tier_id_fkey
      FOREIGN KEY (tier_id) REFERENCES public.msgf_legacy_tiers (tier_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.msgf_legacy_users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  tier_id INTEGER NOT NULL REFERENCES public.msgf_legacy_tiers (tier_id) ON DELETE RESTRICT,
  password_hash CHAR(60) NOT NULL,
  user_role VARCHAR(20) NOT NULL DEFAULT 'fan',
  preferred_theme VARCHAR(20) NOT NULL DEFAULT 'Pleasure',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msgf_legacy_users_email ON public.msgf_legacy_users (email);

CREATE TABLE IF NOT EXISTS public.msgf_legacy_custom_domains (
  domain_id SERIAL PRIMARY KEY,
  author_user_id UUID NOT NULL REFERENCES public.msgf_legacy_users (user_id) ON DELETE CASCADE,
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msgf_legacy_domain_name ON public.msgf_legacy_custom_domains (domain_name);

CREATE TABLE IF NOT EXISTS public.msgf_legacy_tenants (
  id SERIAL PRIMARY KEY,
  domain_name TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.msgf_legacy_tenants (domain_name, author_name, schema_name)
VALUES ('localhost:3002', 'Dev Author', 'public')
ON CONFLICT (domain_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.msgf_legacy_author_profiles (
  author_user_id UUID PRIMARY KEY REFERENCES public.msgf_legacy_users (user_id) ON DELETE CASCADE,
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  persona_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.msgf_legacy_projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES public.msgf_legacy_users (user_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'wip' CHECK (status IN ('wip', 'draft_complete', 'published')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  target_word_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msgf_legacy_projects_author_created
  ON public.msgf_legacy_projects (author_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RAG + HUD (Gemini text-embedding-004 class vectors: 768 dims)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.msgf_legacy_rag_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id UUID NOT NULL REFERENCES public.msgf_legacy_users (user_id) ON DELETE CASCADE,
  project_id UUID NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'world_bible',
      'world_as_character',
      'character_sheet',
      'story_outline',
      'theme_sheet',
      'trope_sensitivity_sheet',
      'parallel_arc_sheet'
    )
  ),
  audience TEXT NOT NULL CHECK (audience IN ('fan', 'author')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.msgf_legacy_rag_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.msgf_legacy_rag_sources (source_id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES public.msgf_legacy_users (user_id) ON DELETE CASCADE,
  project_id UUID NULL,
  audience TEXT NOT NULL CHECK (audience IN ('fan', 'author')),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msgf_legacy_rag_chunks_dedupe
  ON public.msgf_legacy_rag_chunks (author_user_id, project_id, audience, content_hash);

CREATE INDEX IF NOT EXISTS idx_msgf_legacy_rag_chunks_author_project_audience
  ON public.msgf_legacy_rag_chunks (author_user_id, project_id, audience, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_legacy_rag_chunks_embedding_hnsw
  ON public.msgf_legacy_rag_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_msgf_legacy_rag_chunks_metadata_gin
  ON public.msgf_legacy_rag_chunks USING gin (metadata jsonb_path_ops);

CREATE TABLE IF NOT EXISTS public.msgf_legacy_hud_history (
  id BIGSERIAL PRIMARY KEY,
  author_user_id UUID NOT NULL REFERENCES public.msgf_legacy_users (user_id) ON DELETE CASCADE,
  project_id UUID NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  hud_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msgf_legacy_hud_history_author_project_created
  ON public.msgf_legacy_hud_history (author_user_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_legacy_hud_history_author_created
  ON public.msgf_legacy_hud_history (author_user_id, created_at DESC);

COMMENT ON TABLE public.msgf_rules IS 'MSGF policy rows (e.g. RAG source_type allowlists) read by the legacy Express RAG stack.';
COMMENT ON TABLE public.msgf_legacy_rag_chunks IS 'Legacy Librarian RAG chunks (768-dim); use p4_narrative_library_chunks for the TypeScript BFF ingest path.';
