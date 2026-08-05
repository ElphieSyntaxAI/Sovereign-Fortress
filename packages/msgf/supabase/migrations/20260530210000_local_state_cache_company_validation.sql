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
-- Company-admin validation gate before LogicDeltas appear on the global Brain promotion queue.

ALTER TABLE public.local_state_cache
  ADD COLUMN IF NOT EXISTS company_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS company_validated_by_actor_id UUID;

COMMENT ON COLUMN public.local_state_cache.company_validated_at IS
  'When set, a COMPANY_ADMIN has cleared this LogicDelta for visibility on the global vault_core promotion queue (IP-safe review).';
COMMENT ON COLUMN public.local_state_cache.company_validated_by_actor_id IS
  'p4_profiles.user_id of the company admin who validated this row.';

CREATE INDEX IF NOT EXISTS idx_local_state_cache_company_validated_pending
  ON public.local_state_cache (promotion_status, company_validated_at DESC)
  WHERE promotion_status = 'LOCAL_SUCCESS_GLOBAL_PENDING';
