-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
-- =============================================================================
-- Audit columns when a pending LogicDelta is promoted to vault_core.

ALTER TABLE public.local_state_cache
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS vault_narrative_log_id UUID,
  ADD COLUMN IF NOT EXISTS admin_promotion_note TEXT;

COMMENT ON COLUMN public.local_state_cache.promoted_by_actor_id IS
  'Admin / operator user id (audit) who approved global promotion.';
COMMENT ON COLUMN public.local_state_cache.vault_narrative_log_id IS
  'p4_narrative_logs.id for the vault_core row created on promotion.';
COMMENT ON COLUMN public.local_state_cache.admin_promotion_note IS
  'Optional note from the approving operator.';
