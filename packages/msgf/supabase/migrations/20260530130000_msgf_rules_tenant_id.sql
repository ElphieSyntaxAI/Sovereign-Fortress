-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
-- =============================================================================
-- Per-tenant isolation for `msgf_rules` (P2 roadmap, global_mitigations, etc.).
ALTER TABLE public.msgf_rules
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

UPDATE public.msgf_rules
SET tenant_id = COALESCE(tenant_id, '_legacy')
WHERE tenant_id IS NULL;

ALTER TABLE public.msgf_rules
  ALTER COLUMN tenant_id SET DEFAULT '_legacy';

ALTER TABLE public.msgf_rules
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.msgf_rules
  DROP CONSTRAINT IF EXISTS msgf_rules_namespace_key;

ALTER TABLE public.msgf_rules
  ADD CONSTRAINT msgf_rules_tenant_namespace_key
  UNIQUE (tenant_id, rule_namespace, rule_key);

CREATE INDEX IF NOT EXISTS idx_msgf_rules_tenant_namespace
  ON public.msgf_rules (tenant_id, rule_namespace);

COMMENT ON COLUMN public.msgf_rules.tenant_id IS
  'Project silo — rules are never shared across tenants (Project A vs Project B).';
