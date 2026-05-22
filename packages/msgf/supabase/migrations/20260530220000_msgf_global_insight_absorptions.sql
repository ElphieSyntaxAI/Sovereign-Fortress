-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
-- =============================================================================
-- GLOBAL_ADMIN "Absorb into Global Brain" — dedupe + audit trail for Sentinel self-heal → vault_core patterns.

CREATE TABLE IF NOT EXISTS public.msgf_global_insight_absorptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_narrative_log_id UUID NOT NULL UNIQUE,
  vault_narrative_log_id UUID,
  absorbed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  absorbed_by_actor_id UUID
);

CREATE INDEX IF NOT EXISTS idx_msgf_global_insight_absorbed_at
  ON public.msgf_global_insight_absorptions (absorbed_at DESC);

COMMENT ON TABLE public.msgf_global_insight_absorptions IS
  'Tracks successful anonymized local heals absorbed into global_vault (core training / Cross-Ref lineage).';

ALTER TABLE public.msgf_global_insight_absorptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_global_insight_absorptions_service_role_all" ON public.msgf_global_insight_absorptions;
CREATE POLICY "msgf_global_insight_absorptions_service_role_all"
  ON public.msgf_global_insight_absorptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_global_insight_absorptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_global_insight_absorptions TO service_role;
