-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
-- =============================================================================
-- Forensic calibration profiles (author plaintext vs school ciphertext for FERPA-oriented handling).
CREATE TABLE IF NOT EXISTS public.p4_forensic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tenant_scope TEXT NOT NULL CHECK (tenant_scope IN ('author', 'school')),
  storage JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT p4_forensic_profiles_storage_shape CHECK (
    (tenant_scope = 'author' AND storage ? 'mode' AND storage ->> 'mode' = 'plaintext')
    OR (tenant_scope = 'school' AND storage ? 'mode' AND storage ->> 'mode' = 'ciphertext')
  )
);

CREATE INDEX IF NOT EXISTS idx_p4_forensic_profiles_tenant_time ON public.p4_forensic_profiles (tenant_id, created_at DESC);

ALTER TABLE public.p4_forensic_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forensic_select_tenant" ON public.p4_forensic_profiles;
CREATE POLICY "forensic_select_tenant"
ON public.p4_forensic_profiles
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

COMMENT ON TABLE public.p4_forensic_profiles IS
'Calibration payloads: author rows store plaintext JSON; school rows store AES-256-GCM fields only (FERPA).';
