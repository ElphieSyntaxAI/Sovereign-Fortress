-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
-- =============================================================================
-- Librarian (Logic) JSON revision reports keyed by cooldown / lock session.
-- SSOT: docs/AUTHOR_ECOSYSTEM_ROADMAP.md (STATE_COOLDOWN, bicameral audit); RAG: apps/author-ecosystem/docs/rag/.

CREATE TABLE IF NOT EXISTS public.revision_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  locked_until_session TIMESTAMPTZ NOT NULL,
  author_user_id UUID,
  report_kind TEXT NOT NULL DEFAULT 'librarian_logic' CHECK (report_kind IN ('librarian_logic')),
  report_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT revision_reports_session_unique UNIQUE (manuscript_id, locked_until_session, report_kind)
);

CREATE INDEX IF NOT EXISTS idx_revision_reports_manuscript_created
  ON public.revision_reports (manuscript_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revision_reports_tenant_created
  ON public.revision_reports (tenant_id, created_at DESC);

COMMENT ON TABLE public.revision_reports IS
  'BFF Librarian (Logic) audits: JSON continuity + outline adherence vs RAG World Bible / Outline; keyed by locked_until_session (planning cooldown end, tier lock_expires_at, or vault locked_until).';

ALTER TABLE public.revision_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revision_reports_select_tenant" ON public.revision_reports;
CREATE POLICY "revision_reports_select_tenant"
  ON public.revision_reports
  FOR SELECT
  TO authenticated
  USING (
    tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  );
