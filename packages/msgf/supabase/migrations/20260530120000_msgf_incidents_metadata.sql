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
-- Tenant / entity silo on ARBITRATE incidents (dashboard filters).
ALTER TABLE public.msgf_incidents
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.msgf_incidents
  DROP CONSTRAINT IF EXISTS msgf_incidents_metadata_object;

ALTER TABLE public.msgf_incidents
  ADD CONSTRAINT msgf_incidents_metadata_object CHECK (
    metadata IS NULL OR jsonb_typeof(metadata) = 'object'
  );

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_metadata_tenant
  ON public.msgf_incidents ((metadata->>'tenant_id'))
  WHERE metadata ? 'tenant_id';

CREATE INDEX IF NOT EXISTS idx_msgf_incidents_metadata_entity
  ON public.msgf_incidents ((metadata->>'entity_id'))
  WHERE metadata ? 'entity_id';

COMMENT ON COLUMN public.msgf_incidents.metadata IS
  'Silo scope: tenant_id (project), entity_id (actor UUID), optional project_origin.';
