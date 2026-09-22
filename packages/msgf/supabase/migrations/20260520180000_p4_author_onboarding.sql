-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
-- =============================================================================
-- Author onboarding: HAL startup pace + document ingest review sessions.

ALTER TABLE public.p4_profiles
  ADD COLUMN IF NOT EXISTS hal_startup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hal_startup_prompt TEXT,
  ADD COLUMN IF NOT EXISTS hal_startup_word_count INTEGER,
  ADD COLUMN IF NOT EXISTS hal_startup_ledger_id UUID;

COMMENT ON COLUMN public.p4_profiles.hal_startup_completed_at IS
  'First 5-minute typing calibration after Vault Pact; seeds HAL identity root pace.';
COMMENT ON COLUMN public.p4_profiles.hal_startup_prompt IS
  'Inspiring prompt shown for the initial HAL startup typing session.';

CREATE TABLE IF NOT EXISTS public.p4_document_ingest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('world_bible', 'current_draft', 'character_sheet')),
  original_filename TEXT NOT NULL DEFAULT 'upload',
  word_count INTEGER NOT NULL DEFAULT 0,
  page_estimate INTEGER NOT NULL DEFAULT 0,
  requires_authorship_gate BOOLEAN NOT NULL DEFAULT FALSE,
  authorship_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  scan_thoughts JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_wiki JSONB NOT NULL DEFAULT '[]'::jsonb,
  outline_beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'scanning'
    CHECK (status IN ('scanning', 'authorship', 'review', 'committed', 'cancelled')),
  content_digest TEXT,
  /** Full extracted text for authorship answer checks (app caps upload size). */
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_p4_document_ingest_tenant
  ON public.p4_document_ingest_sessions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p4_document_ingest_manuscript
  ON public.p4_document_ingest_sessions (manuscript_id, status);

ALTER TABLE public.p4_document_ingest_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.p4_document_ingest_sessions IS
  'Ephemeral document onboarding ingest: scan narration, authorship Q&A, wiki preview before commit to P4 RAG.';
