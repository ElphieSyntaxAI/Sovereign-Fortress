-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
-- =============================================================================
-- Session-local LogicDelta cache (pending global promotion).

CREATE TABLE IF NOT EXISTS public.local_state_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  delta_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  promotion_status TEXT NOT NULL DEFAULT 'LOCAL_SUCCESS_GLOBAL_PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_local_state_cache_tenant_entity
  ON public.local_state_cache (tenant_id, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_state_cache_promotion_pending
  ON public.local_state_cache (promotion_status)
  WHERE promotion_status = 'LOCAL_SUCCESS_GLOBAL_PENDING';

COMMENT ON TABLE public.local_state_cache IS
  'Non-admin self-heal / globalize-pending LogicDelta rows. Promoted to vault_core + global_msgf_rules by admin only.';

ALTER TABLE public.local_state_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "local_state_cache_service_role_all" ON public.local_state_cache;
CREATE POLICY "local_state_cache_service_role_all"
  ON public.local_state_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.local_state_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.local_state_cache TO service_role;
