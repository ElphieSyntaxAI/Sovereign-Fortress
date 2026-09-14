-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
-- =============================================================================
-- =============================================================================
-- A5: Append-only skip-MSGF audit (never silent bypass).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_skip_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_origin TEXT NOT NULL,
  actor TEXT,
  git_sha TEXT,
  reason TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_skip_audit_origin_len CHECK (char_length(project_origin) <= 512)
);

CREATE INDEX IF NOT EXISTS idx_msgf_skip_audit_created
  ON public.msgf_skip_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_skip_audit_origin
  ON public.msgf_skip_audit (project_origin, created_at DESC);

COMMENT ON TABLE public.msgf_skip_audit IS
  'A5: HMAC-signed audit when IDE sets msgf.skipMsgf / MSGF_SKIP=1.';

ALTER TABLE public.msgf_skip_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_skip_audit_service_role_all ON public.msgf_skip_audit;
CREATE POLICY msgf_skip_audit_service_role_all
  ON public.msgf_skip_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_skip_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_skip_audit TO service_role;
