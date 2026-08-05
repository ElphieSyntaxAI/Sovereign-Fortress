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
-- V3.2 ARBITRATE — HITL / LOM recursion incidents for M4 Ops Dashboard.

CREATE TABLE IF NOT EXISTS public.msgf_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  narrative_log_id UUID REFERENCES public.p4_narrative_logs (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'SYSTEM',
  bug_index JSONB NOT NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msgf_incidents_status_check CHECK (status IN ('pending', 'resolved')),
  CONSTRAINT msgf_incidents_source_check CHECK (
    source IN ('SYSTEM', 'USER_SENTINEL', 'ARBITRATE_AUTO')
  ),
  CONSTRAINT msgf_incidents_bug_index_object CHECK (jsonb_typeof(bug_index) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_source_status_created
  ON public.msgf_incidents (source, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_status_created
  ON public.msgf_incidents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_user_created
  ON public.msgf_incidents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_narrative_log
  ON public.msgf_incidents (narrative_log_id)
  WHERE narrative_log_id IS NOT NULL;

COMMENT ON TABLE public.msgf_incidents IS
  'ARBITRATE queue: auto-opened on 1.1.1_HITL_TIEBREAKER or 1.1.1_LOM_RECURSION_LIMIT Hall events.';

COMMENT ON COLUMN public.msgf_incidents.bug_index IS
  'Genealogical 1.1.1 index JSON (level_1_category, level_1_1_branch, level_1_1_1_instance).';

CREATE OR REPLACE FUNCTION public.msgf_incidents_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_msgf_incidents_updated_at ON public.msgf_incidents;

CREATE TRIGGER trg_msgf_incidents_updated_at
  BEFORE UPDATE ON public.msgf_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.msgf_incidents_set_updated_at();

ALTER TABLE public.msgf_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_incidents_service_role_all" ON public.msgf_incidents;

CREATE POLICY "msgf_incidents_service_role_all"
  ON public.msgf_incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_incidents FROM PUBLIC;
REVOKE ALL ON public.msgf_incidents FROM anon;
REVOKE ALL ON public.msgf_incidents FROM authenticated;

GRANT ALL ON public.msgf_incidents TO service_role;
