-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.msgf_shadow_evaluation_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  mode TEXT NOT NULL DEFAULT 'shadow' CHECK (mode IN ('shadow', 'active')),
  stream BOOLEAN NOT NULL DEFAULT false,
  prompt_hash TEXT NOT NULL DEFAULT '',
  actual_tokens BIGINT NOT NULL DEFAULT 0 CHECK (actual_tokens >= 0),
  actual_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (actual_cost_usd >= 0),
  projected_tokens BIGINT NOT NULL DEFAULT 0 CHECK (projected_tokens >= 0),
  projected_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (projected_cost_usd >= 0),
  savings_potential_usd DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (savings_potential_usd >= 0),
  recommended_action TEXT NOT NULL DEFAULT 'KEEP_AS_IS',
  usage_source TEXT NOT NULL DEFAULT 'estimated' CHECK (usage_source IN ('provider', 'estimated')),
  model TEXT NOT NULL DEFAULT '',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_shadow_evaluation_logs_tenant_observed_idx
  ON public.msgf_shadow_evaluation_logs (tenant_id, observed_at DESC);

COMMENT ON TABLE public.msgf_shadow_evaluation_logs IS
  'Shadow Proxy async evaluations: actual vs projected cost. Projected only — never feed public eco.';
