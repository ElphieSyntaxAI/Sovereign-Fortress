-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.msgf_period_savings_reports (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id UUID,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('weekly', 'monthly')),
  period_key TEXT NOT NULL,
  period_label TEXT NOT NULL DEFAULT '',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tokens_consumed_metered BIGINT NOT NULL DEFAULT 0 CHECK (tokens_consumed_metered >= 0),
  tokens_saved_proven BIGINT NOT NULL DEFAULT 0 CHECK (tokens_saved_proven >= 0),
  tokens_saved_estimated BIGINT NOT NULL DEFAULT 0 CHECK (tokens_saved_estimated >= 0),
  provider_calls BIGINT NOT NULL DEFAULT 0 CHECK (provider_calls >= 0),
  shadow_projected_usd DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (shadow_projected_usd >= 0),
  eco_kwh DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (eco_kwh >= 0),
  eco_co2e_lbs DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (eco_co2e_lbs >= 0),
  eco_water_gal DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (eco_water_gal >= 0),
  eco_claimable BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_kind, period_key)
);

CREATE INDEX IF NOT EXISTS msgf_period_savings_reports_tenant_kind_key_idx
  ON public.msgf_period_savings_reports (tenant_id, period_kind, period_key DESC);

COMMENT ON TABLE public.msgf_period_savings_reports IS
  'Logged weekly (3 recent) and monthly MSGF metered consumption + proven savings for historical tables.';
