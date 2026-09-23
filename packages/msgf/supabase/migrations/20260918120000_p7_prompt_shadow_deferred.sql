-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
-- =============================================================================
-- P7: prompt ledger + Shadow deferred reputation apply-on-activate.

ALTER TABLE public.msgf_resource_reputation
  DROP CONSTRAINT IF EXISTS msgf_resource_reputation_ledger_check;

ALTER TABLE public.msgf_resource_reputation
  ADD CONSTRAINT msgf_resource_reputation_ledger_check
  CHECK (ledger IN (
    'vault', 'hall', 'file', 'tool', 'search', 'mcp', 'agent', 'citation', 'pack', 'prompt'
  ));

ALTER TABLE public.msgf_shadow_evaluation_logs
  ADD COLUMN IF NOT EXISTS p7_promote_count INTEGER NOT NULL DEFAULT 0
    CHECK (p7_promote_count >= 0);

ALTER TABLE public.msgf_shadow_evaluation_logs
  ADD COLUMN IF NOT EXISTS p7_block_count INTEGER NOT NULL DEFAULT 0
    CHECK (p7_block_count >= 0);

ALTER TABLE public.msgf_shadow_evaluation_logs
  ADD COLUMN IF NOT EXISTS p7_deferred JSONB;

ALTER TABLE public.msgf_shadow_evaluation_logs
  ADD COLUMN IF NOT EXISTS p7_applied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS msgf_shadow_evaluation_logs_p7_pending_idx
  ON public.msgf_shadow_evaluation_logs (tenant_id, id)
  WHERE p7_applied_at IS NULL AND p7_deferred IS NOT NULL;

COMMENT ON COLUMN public.msgf_shadow_evaluation_logs.p7_deferred IS
  'Hashed P7 hits projected during Shadow (resource_key/ledger/kind/outcome). Applied once on 3-day full-access activate.';

COMMENT ON COLUMN public.msgf_shadow_evaluation_logs.p7_applied_at IS
  'Set when deferred P7 hits are claimed into msgf_resource_reputation. NULL = not applied.';
