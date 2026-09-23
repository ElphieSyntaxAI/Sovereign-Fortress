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
-- MSGF document compiler sessions (product-neutral scan/commit orchestration).

CREATE TABLE IF NOT EXISTS public.msgf_document_compiler_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  domain_profile TEXT NOT NULL CHECK (
    domain_profile IN ('author_narrative', 'education_curriculum', 'generic')
  ),
  project_origin TEXT,
  manuscript_id UUID,
  subject_domain TEXT,
  original_filename TEXT NOT NULL DEFAULT 'upload',
  source_text TEXT,
  compiler_state JSONB,
  proposed_wiki JSONB NOT NULL DEFAULT '[]'::jsonb,
  outline_beats JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'scanning'
    CHECK (status IN ('scanning', 'review', 'committed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msgf_doc_compiler_tenant
  ON public.msgf_document_compiler_sessions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_doc_compiler_status
  ON public.msgf_document_compiler_sessions (status, created_at DESC);

COMMENT ON TABLE public.msgf_document_compiler_sessions IS
  'MSGF 3-pass document compiler scan/commit sessions (Author, Syntax Educates, external hookups).';

ALTER TABLE public.p4_document_ingest_sessions
  ADD COLUMN IF NOT EXISTS domain_profile TEXT DEFAULT 'author_narrative',
  ADD COLUMN IF NOT EXISTS compiler_state JSONB;
