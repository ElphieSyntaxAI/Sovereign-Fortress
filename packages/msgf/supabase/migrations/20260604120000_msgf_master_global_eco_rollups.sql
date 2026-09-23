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
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */

CREATE SCHEMA IF NOT EXISTS msgf_master;

CREATE TABLE IF NOT EXISTS msgf_master.global_eco_rollups (
  tenant_id TEXT PRIMARY KEY,
  total_tokens_saved BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens_saved >= 0),
  total_grid_compute_prevented_kwh DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_grid_compute_prevented_kwh >= 0),
  total_co2e_offset_lbs DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_co2e_offset_lbs >= 0),
  total_freshwater_conserved_gallons DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_freshwater_conserved_gallons >= 0),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE msgf_master.global_eco_rollups IS
'Master Admin Portal cumulative Sustainable Compute Layer rollups for B2B tenant eco telemetry.';

CREATE OR REPLACE FUNCTION public.msgf_master_increment_global_eco_rollup(
  p_tenant_id TEXT,
  p_tokens_saved BIGINT,
  p_grid_compute_prevented_kwh DOUBLE PRECISION,
  p_co2e_offset_lbs DOUBLE PRECISION,
  p_freshwater_conserved_gallons DOUBLE PRECISION,
  p_observed_at TIMESTAMPTZ
)
RETURNS TABLE (
  tenant_id TEXT,
  total_tokens_saved BIGINT,
  total_grid_compute_prevented_kwh DOUBLE PRECISION,
  total_co2e_offset_lbs DOUBLE PRECISION,
  total_freshwater_conserved_gallons DOUBLE PRECISION,
  last_observed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, msgf_master
AS $$
BEGIN
  IF p_tenant_id IS NULL OR btrim(p_tenant_id) = '' THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_tokens_saved < 0
    OR p_grid_compute_prevented_kwh < 0
    OR p_co2e_offset_lbs < 0
    OR p_freshwater_conserved_gallons < 0 THEN
    RAISE EXCEPTION 'eco rollup increments must be non-negative';
  END IF;

  RETURN QUERY
  INSERT INTO msgf_master.global_eco_rollups AS r (
    tenant_id,
    total_tokens_saved,
    total_grid_compute_prevented_kwh,
    total_co2e_offset_lbs,
    total_freshwater_conserved_gallons,
    last_observed_at,
    updated_at
  )
  VALUES (
    btrim(p_tenant_id),
    p_tokens_saved,
    p_grid_compute_prevented_kwh,
    p_co2e_offset_lbs,
    p_freshwater_conserved_gallons,
    COALESCE(p_observed_at, now()),
    now()
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    total_tokens_saved = r.total_tokens_saved + EXCLUDED.total_tokens_saved,
    total_grid_compute_prevented_kwh =
      r.total_grid_compute_prevented_kwh + EXCLUDED.total_grid_compute_prevented_kwh,
    total_co2e_offset_lbs =
      r.total_co2e_offset_lbs + EXCLUDED.total_co2e_offset_lbs,
    total_freshwater_conserved_gallons =
      r.total_freshwater_conserved_gallons + EXCLUDED.total_freshwater_conserved_gallons,
    last_observed_at = GREATEST(r.last_observed_at, EXCLUDED.last_observed_at),
    updated_at = now()
  RETURNING
    r.tenant_id,
    r.total_tokens_saved,
    r.total_grid_compute_prevented_kwh,
    r.total_co2e_offset_lbs,
    r.total_freshwater_conserved_gallons,
    r.last_observed_at;
END;
$$;

GRANT USAGE ON SCHEMA msgf_master TO service_role;
GRANT SELECT, INSERT, UPDATE ON msgf_master.global_eco_rollups TO service_role;
GRANT EXECUTE ON FUNCTION public.msgf_master_increment_global_eco_rollup(
  TEXT,
  BIGINT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TIMESTAMPTZ
) TO service_role;
