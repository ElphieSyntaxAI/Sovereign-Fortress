-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
-- =============================================================================
-- ARBITRATE: pre-generated HITL fix strategies (P2 roadmap + consequence scores).

ALTER TABLE public.msgf_incidents
  ADD COLUMN IF NOT EXISTS strategies JSONB;

COMMENT ON COLUMN public.msgf_incidents.strategies IS
  'HITL only: AI-generated fix options with P2 alignment and consequence_score (0–100).';

ALTER TABLE public.msgf_incidents
  DROP CONSTRAINT IF EXISTS msgf_incidents_strategies_object;

ALTER TABLE public.msgf_incidents
  ADD CONSTRAINT msgf_incidents_strategies_object CHECK (
    strategies IS NULL OR jsonb_typeof(strategies) = 'object'
  );
