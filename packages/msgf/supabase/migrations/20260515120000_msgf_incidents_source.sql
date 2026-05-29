-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
-- =============================================================================
-- Dashboard filter for Sentinel / operator-reported incidents.
-- Runs before 20260528120000_msgf_incidents.sql on timestamp order; no-op until table exists.
-- Column is also defined on CREATE TABLE in 20260528120000 for greenfield installs.

DO $migrate$
BEGIN
  IF to_regclass('public.msgf_incidents') IS NULL THEN
    RAISE NOTICE 'msgf_incidents missing; skip source column (applied with 20260528120000)';
    RETURN;
  END IF;

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
END
$migrate$;
