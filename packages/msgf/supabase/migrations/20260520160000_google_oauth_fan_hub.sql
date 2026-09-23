-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
-- =============================================================================
-- Google OAuth credentials, manuscript link sessions, fan hub config, fan mail.

CREATE TABLE IF NOT EXISTS public.p4_author_google_credentials (
  tenant_id UUID PRIMARY KEY,
  google_email TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.p4_author_google_credentials IS
  'Per-author Google OAuth (Drive/Docs read) for Librarian sync and link-session validation. BFF service-role only.';

ALTER TABLE public.p4_author_google_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.p4_manuscript_link_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reported', 'confirmed', 'expired', 'cancelled')),
  google_doc_id TEXT,
  google_doc_title TEXT,
  google_doc_url TEXT,
  reported_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_link_sessions_manuscript
  ON public.p4_manuscript_link_sessions (manuscript_id, created_at DESC);

ALTER TABLE public.p4_manuscript_link_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.p4_fan_hub_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  template_id TEXT NOT NULL DEFAULT 'aurora',
  theme JSONB NOT NULL DEFAULT '{"primary":"#8b5cf6","accent":"#f59e0b","background":"#0a0612"}'::JSONB,
  modules JSONB NOT NULL DEFAULT '{
    "polls": true,
    "games": true,
    "fan_rag": true,
    "progress_bar": {"enabled": false, "shared": false},
    "fan_mail": true,
    "quizzes": true,
    "fan_art_slots": 3
  }'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, manuscript_id)
);

ALTER TABLE public.p4_fan_hub_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.p4_fan_mail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  fan_display_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_fan_mail_manuscript
  ON public.p4_fan_mail (manuscript_id, created_at DESC);

ALTER TABLE public.p4_fan_mail ENABLE ROW LEVEL SECURITY;
