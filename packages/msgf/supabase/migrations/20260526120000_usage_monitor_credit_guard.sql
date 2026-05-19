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
-- MSGF credit guard: per-actor token totals + singleton project spend for soft-cap checks.

CREATE TABLE IF NOT EXISTS public.usage_monitor (
  user_id TEXT PRIMARY KEY,
  tokens_cumulative BIGINT NOT NULL DEFAULT 0 CHECK (tokens_cumulative >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.usage_monitor IS
  'Per-user or synthetic actor (tenant:uuid, anon:hash) cumulative token estimate for MSGF creditGuard middleware.';

CREATE INDEX IF NOT EXISTS idx_usage_monitor_updated ON public.usage_monitor (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.msgf_project_billing (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  spend_usd NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (spend_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.msgf_project_billing (id, spend_usd)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.msgf_project_billing IS
  'Singleton row (id=1): backend-updated project spend in USD for MSGF soft billing cap.';

ALTER TABLE public.usage_monitor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_project_billing ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no policies for anon/authenticated on purpose.
