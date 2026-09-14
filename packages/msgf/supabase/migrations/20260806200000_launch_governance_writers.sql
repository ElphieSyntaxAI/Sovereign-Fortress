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
ALTER TABLE public.msgf_proven_avoidance_events
  ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.msgf_proven_avoidance_events
  ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE public.msgf_proven_avoidance_events
  ADD COLUMN IF NOT EXISTS prompt_hash TEXT;
ALTER TABLE public.msgf_proven_avoidance_events
  ADD COLUMN IF NOT EXISTS routing_strategy TEXT;
ALTER TABLE public.msgf_proven_avoidance_events
  ADD COLUMN IF NOT EXISTS saved_cost_usd NUMERIC(12, 6);

ALTER TABLE public.msgf_provider_usage_events
  ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE public.msgf_provider_usage_events
  ADD COLUMN IF NOT EXISTS prompt_hash TEXT;

CREATE INDEX IF NOT EXISTS msgf_proven_avoidance_events_prompt_hash_idx
  ON public.msgf_proven_avoidance_events (prompt_hash)
  WHERE prompt_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS msgf_provider_usage_events_prompt_hash_idx
  ON public.msgf_provider_usage_events (prompt_hash)
  WHERE prompt_hash IS NOT NULL;
