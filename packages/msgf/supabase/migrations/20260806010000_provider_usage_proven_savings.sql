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
CREATE TABLE IF NOT EXISTS public.msgf_provider_usage_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'google', 'xai', 'openai', 'unknown')),
  model TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT 'other',
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  request_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_provider_usage_events_tenant_observed_idx
  ON public.msgf_provider_usage_events (tenant_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.msgf_proven_avoidance_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  tokens_avoided BIGINT NOT NULL CHECK (tokens_avoided >= 0),
  baseline_tokens BIGINT NOT NULL DEFAULT 0 CHECK (baseline_tokens >= 0),
  local_tokens BIGINT NOT NULL DEFAULT 0 CHECK (local_tokens >= 0),
  evidence TEXT NOT NULL CHECK (evidence IN ('proven_avoidance', 'pack_delta', 'metered_provider', 'estimated_model')),
  baseline_source TEXT NOT NULL DEFAULT 'none',
  sample_count INT NOT NULL DEFAULT 0,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_proven_avoidance_events_tenant_observed_idx
  ON public.msgf_proven_avoidance_events (tenant_id, observed_at DESC);

COMMENT ON TABLE public.msgf_provider_usage_events IS
  'Metered LLM response.usage from MSGF-owned provider calls (spend truth).';

COMMENT ON TABLE public.msgf_proven_avoidance_events IS
  'Avoided tokens eligible for eco claims — metered baseline or audited pack deltas only.';
