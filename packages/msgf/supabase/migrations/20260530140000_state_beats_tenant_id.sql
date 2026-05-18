-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
-- =============================================================================
-- Tenant silo on state_beats (entity remains in author_id = human actor UUID).
ALTER TABLE public.state_beats
  ADD COLUMN IF NOT EXISTS tenant_id text;

UPDATE public.state_beats
SET tenant_id = COALESCE(metadata->>'tenant_id', author_id)
WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_state_beats_tenant_author_seq
  ON public.state_beats (tenant_id, author_id, sequence_index);

COMMENT ON COLUMN public.state_beats.tenant_id IS
  'MSGF project silo; filter with author_id (entity) for per-tenant session beats.';
