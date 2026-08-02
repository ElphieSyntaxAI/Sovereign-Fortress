-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
-- =============================================================================
-- Verified MSGF context-pack confirmations (prompt optimizer / confirm-pack).

CREATE TABLE IF NOT EXISTS public.context_pack_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  entity_id TEXT,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  naive_char_count INTEGER NOT NULL DEFAULT 0 CHECK (naive_char_count >= 0),
  sharded_char_count INTEGER NOT NULL DEFAULT 0 CHECK (sharded_char_count >= 0),
  user_intent_excerpt TEXT,
  source TEXT NOT NULL DEFAULT 'confirm_pack',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_pack_transactions_tenant_verified
  ON public.context_pack_transactions (tenant_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_pack_transactions_pack
  ON public.context_pack_transactions (pack_id);

COMMENT ON TABLE public.context_pack_transactions IS
  'Audit log when a developer confirms they used an MSGF context pack in an external agent.';

ALTER TABLE public.context_pack_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "context_pack_transactions_service_role_all" ON public.context_pack_transactions;
CREATE POLICY "context_pack_transactions_service_role_all"
  ON public.context_pack_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "context_pack_transactions_select_own_tenant" ON public.context_pack_transactions;
CREATE POLICY "context_pack_transactions_select_own_tenant"
  ON public.context_pack_transactions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT DISTINCT t.tenant_id
      FROM public.msgf_ide_tokens t
      WHERE t.user_id = auth.uid() AND t.revoked_at IS NULL
    )
  );

REVOKE ALL ON public.context_pack_transactions FROM PUBLIC, anon;
GRANT ALL ON public.context_pack_transactions TO service_role;
GRANT SELECT ON public.context_pack_transactions TO authenticated;
