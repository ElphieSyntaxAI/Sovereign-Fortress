-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
-- =============================================================================
-- Bilateral editor proof-of-effort (POEE) and suggestion audit trail (BFF / service_role writes).

CREATE TABLE IF NOT EXISTS public.p4_editor_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  editor_user_id UUID,
  event_kind TEXT NOT NULL DEFAULT 'POEE',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_editor_ledger_manuscript_created
  ON public.p4_editor_ledger (manuscript_id, created_at DESC);

COMMENT ON TABLE public.p4_editor_ledger IS
  'Editor-side immutable events (e.g. POEE for each suggestion) — manuscript body is not mutated here.';

COMMENT ON COLUMN public.p4_editor_ledger.event_kind IS
  'e.g. POEE = Proof of Editorial Effort for a suggestion snapshot.';

ALTER TABLE public.p4_editor_ledger ENABLE ROW LEVEL SECURITY;
