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
-- Add shadow projected USD column if period reports table already existed without it.
ALTER TABLE public.msgf_period_savings_reports
  ADD COLUMN IF NOT EXISTS shadow_projected_usd DOUBLE PRECISION NOT NULL DEFAULT 0
  CHECK (shadow_projected_usd >= 0);
