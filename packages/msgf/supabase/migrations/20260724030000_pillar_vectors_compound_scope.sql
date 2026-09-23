-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
-- =============================================================================
-- =============================================================================
-- A4: Dual-key vector scope indexes (company_id + project_origin + subpath_hash)
-- App-layer filters remain mandatory on service_role Pulse paths.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_meta_compound_scope
  ON public.pillar_vectors (
    (metadata->>'company_id'),
    (metadata->>'project_origin'),
    (metadata->>'subpath_hash')
  )
  WHERE metadata ? 'project_origin';

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_meta_subpath_hash
  ON public.pillar_vectors ((metadata->>'subpath_hash'))
  WHERE metadata ? 'subpath_hash';

COMMENT ON INDEX public.idx_pillar_vectors_meta_compound_scope IS
  'A4 compound Vault/Hall scope for IDE project_origin + path isolation.';

-- Sandbox cold layer mirror (DEV_TEST)
CREATE INDEX IF NOT EXISTS idx_msgf_sandbox_meta_compound_scope
  ON public.msgf_sandbox (
    (metadata->>'company_id'),
    (metadata->>'project_origin'),
    (metadata->>'subpath_hash')
  )
  WHERE metadata ? 'project_origin';
