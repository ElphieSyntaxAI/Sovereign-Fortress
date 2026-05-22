-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
-- =============================================================================
-- MSGF operator RBAC: company silo + dashboard role (GLOBAL / COMPANY / DEVELOPER).

ALTER TABLE public.p4_profiles
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS msgf_access_role TEXT NOT NULL DEFAULT 'DEVELOPER';

ALTER TABLE public.p4_profiles
  DROP CONSTRAINT IF EXISTS p4_profiles_msgf_access_role_check;

ALTER TABLE public.p4_profiles
  ADD CONSTRAINT p4_profiles_msgf_access_role_check
  CHECK (
    msgf_access_role IN ('GLOBAL_ADMIN', 'COMPANY_ADMIN', 'DEVELOPER')
  );

CREATE INDEX IF NOT EXISTS idx_p4_profiles_company_id
  ON public.p4_profiles (company_id)
  WHERE company_id IS NOT NULL;

COMMENT ON COLUMN public.p4_profiles.company_id IS
  'Tenant / employer silo for MSGF dashboard isolation (company admins see this org only).';

COMMENT ON COLUMN public.p4_profiles.msgf_access_role IS
  'MSGF ops role: GLOBAL_ADMIN | COMPANY_ADMIN | DEVELOPER (default).';

ALTER TABLE public.local_state_cache
  ADD COLUMN IF NOT EXISTS company_id UUID;

CREATE INDEX IF NOT EXISTS idx_local_state_cache_company_pending
  ON public.local_state_cache (company_id, promotion_status)
  WHERE promotion_status = 'LOCAL_SUCCESS_GLOBAL_PENDING'
    AND company_id IS NOT NULL;

COMMENT ON COLUMN public.local_state_cache.company_id IS
  'Optional company silo for scoped pending-promotion lists.';
