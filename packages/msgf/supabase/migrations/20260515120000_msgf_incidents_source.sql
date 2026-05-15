-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
-- =============================================================================
-- Dashboard filter for Sentinel / operator-reported incidents.

ALTER TABLE public.msgf_incidents
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'SYSTEM';

ALTER TABLE public.msgf_incidents
  DROP CONSTRAINT IF EXISTS msgf_incidents_source_check;

ALTER TABLE public.msgf_incidents
  ADD CONSTRAINT msgf_incidents_source_check CHECK (
    source IN ('SYSTEM', 'USER_SENTINEL', 'ARBITRATE_AUTO')
  );

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_source_status_created
  ON public.msgf_incidents (source, status, created_at DESC);

COMMENT ON COLUMN public.msgf_incidents.source IS
  'Incident origin: SYSTEM (pipeline), USER_SENTINEL (Report Issue FAB), ARBITRATE_AUTO (HITL/LOM).';
