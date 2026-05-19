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
-- MSGF contract licensing layer (internal / B2B Brain access).
-- Plain-text keys are minted offline via scripts/mint-license.mjs; only SHA-256 hashes are stored.

CREATE TABLE IF NOT EXISTS public.msgf_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_hash TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  credits_total INTEGER NOT NULL DEFAULT 0 CHECK (credits_total >= 0),
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msgf_licenses_license_key_hash_unique UNIQUE (license_key_hash),
  CONSTRAINT msgf_licenses_license_key_hash_format CHECK (
    char_length(license_key_hash) = 64
    AND license_key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT msgf_licenses_credits_used_lte_total CHECK (credits_used <= credits_total),
  CONSTRAINT msgf_licenses_status_check CHECK (
    status IN ('active', 'revoked', 'suspended', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_msgf_licenses_tenant_status
  ON public.msgf_licenses (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_msgf_licenses_tier_id
  ON public.msgf_licenses (tier_id);

COMMENT ON TABLE public.msgf_licenses IS
  'Contract-based MSGF Brain licenses. Key material is never stored; mint via mint-license.mjs (service_role only).';

COMMENT ON COLUMN public.msgf_licenses.license_key_hash IS
  'SHA-256 hex digest of the full msgf_live_... secret (64 lowercase hex chars).';

COMMENT ON COLUMN public.msgf_licenses.tenant_id IS
  'Internal tenant slug, e.g. author_ecosystem, syntax_education.';

COMMENT ON COLUMN public.msgf_licenses.tier_id IS
  'Contract tier slug (text), not necessarily msgf_legacy_tiers.tier_id.';

CREATE OR REPLACE FUNCTION public.msgf_licenses_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_msgf_licenses_updated_at ON public.msgf_licenses;

CREATE TRIGGER trg_msgf_licenses_updated_at
  BEFORE UPDATE ON public.msgf_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.msgf_licenses_set_updated_at();

ALTER TABLE public.msgf_licenses ENABLE ROW LEVEL SECURITY;

-- System table: no anon/authenticated access. Service role bypasses RLS; policy documents intent.
DROP POLICY IF EXISTS "msgf_licenses_service_role_all" ON public.msgf_licenses;

CREATE POLICY "msgf_licenses_service_role_all"
  ON public.msgf_licenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_licenses FROM PUBLIC;
REVOKE ALL ON public.msgf_licenses FROM anon;
REVOKE ALL ON public.msgf_licenses FROM authenticated;

GRANT ALL ON public.msgf_licenses TO service_role;
