-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
-- =============================================================================
-- =============================================================================
-- PAID_INDIVIDUAL — monthly token metering + individual billing ledger (CONVERGE).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_paid_individual_monthly_usage (
  entity_id TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  tokens_consumed BIGINT NOT NULL DEFAULT 0 CHECK (tokens_consumed >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_id, billing_period)
);

COMMENT ON TABLE public.msgf_paid_individual_monthly_usage IS
  'Per-entity calendar-month token consumption for PAID_INDIVIDUAL CONVERGE platform routing.';

CREATE INDEX IF NOT EXISTS idx_msgf_paid_individual_usage_period
  ON public.msgf_paid_individual_monthly_usage (billing_period DESC);

CREATE TABLE IF NOT EXISTS public.msgf_individual_billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  tokens BIGINT NOT NULL CHECK (tokens > 0),
  operation TEXT NOT NULL DEFAULT 'converge_debit',
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS msgf_individual_billing_ledger_idempotent
  ON public.msgf_individual_billing_ledger (entity_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE public.msgf_individual_billing_ledger IS
  'Append-only debits for PAID_INDIVIDUAL platform consensus (master API keys).';

ALTER TABLE public.msgf_paid_individual_monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_individual_billing_ledger ENABLE ROW LEVEL SECURITY;
