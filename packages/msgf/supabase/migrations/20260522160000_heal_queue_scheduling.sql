-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
-- =============================================================================
-- =============================================================================
-- Heal queue — scheduling_tier column for cron batch (MSGF_OPS_CRON_SECRET / v32-heartbeat)
-- preset_interval stored in metadata JSONB on the same row.
-- =============================================================================

ALTER TABLE public.pillar_vectors
  ADD COLUMN IF NOT EXISTS scheduling_tier text;

COMMENT ON COLUMN public.pillar_vectors.scheduling_tier IS
  'V3.2 heal-queue tier: RED (immediate), YELLOW (1h/6h), GREEN (nightly). NULL = not scheduled.';

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_scheduling_tier
  ON public.pillar_vectors (scheduling_tier)
  WHERE scheduling_tier IS NOT NULL;
