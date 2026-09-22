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
-- Trusted permissive OSS allowlist for ARBITRATE bulk-triage (Phase 3).
CREATE TABLE IF NOT EXISTS public.msgf_trusted_license_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'company', 'tenant')),
  tenant_id TEXT,
  company_id TEXT,
  licenses TEXT[] NOT NULL DEFAULT ARRAY['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','0BSD'],
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_trusted_license_allowlist_scope_idx
  ON public.msgf_trusted_license_allowlist (scope, enabled);

ALTER TABLE public.msgf_trusted_license_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msgf_trusted_license_allowlist_service_role_all"
  ON public.msgf_trusted_license_allowlist;
CREATE POLICY "msgf_trusted_license_allowlist_service_role_all"
  ON public.msgf_trusted_license_allowlist
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.msgf_trusted_license_allowlist FROM PUBLIC;
REVOKE ALL ON public.msgf_trusted_license_allowlist FROM anon;
REVOKE ALL ON public.msgf_trusted_license_allowlist FROM authenticated;

INSERT INTO public.msgf_trusted_license_allowlist (scope, licenses, enabled)
SELECT 'global', ARRAY['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','0BSD','Unlicense'], true
WHERE NOT EXISTS (
  SELECT 1 FROM public.msgf_trusted_license_allowlist WHERE scope = 'global' AND tenant_id IS NULL
);

COMMENT ON TABLE public.msgf_trusted_license_allowlist IS
  'Allowlist for one-click ARBITRATE bulk-triage of known permissive OSS; A6 still records each resolve.';
