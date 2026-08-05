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
-- =============================================================================
-- A6: Append-only signed ARBITRATE HITL audit (hash-chained).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_arbitrate_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  project_origin TEXT NOT NULL,
  incident_id UUID,
  operator_id TEXT,
  action TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  signature TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_arbitrate_audit_origin_len CHECK (char_length(project_origin) <= 512),
  CONSTRAINT msgf_arbitrate_audit_source_len CHECK (char_length(source) <= 64),
  CONSTRAINT msgf_arbitrate_audit_action_len CHECK (char_length(action) <= 128)
);

CREATE INDEX IF NOT EXISTS idx_msgf_arbitrate_audit_created
  ON public.msgf_arbitrate_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_arbitrate_audit_origin
  ON public.msgf_arbitrate_audit (project_origin, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_arbitrate_audit_incident
  ON public.msgf_arbitrate_audit (incident_id)
  WHERE incident_id IS NOT NULL;

COMMENT ON TABLE public.msgf_arbitrate_audit IS
  'A6: HMAC-signed, hash-chained ARBITRATE HITL resolve snapshots.';

ALTER TABLE public.msgf_arbitrate_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_arbitrate_audit_service_role_all ON public.msgf_arbitrate_audit;
CREATE POLICY msgf_arbitrate_audit_service_role_all
  ON public.msgf_arbitrate_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_arbitrate_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_arbitrate_audit TO service_role;
