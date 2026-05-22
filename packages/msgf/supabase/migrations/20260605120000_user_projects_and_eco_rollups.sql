-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
-- =============================================================================
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */

-- User-owned local / GitHub project mappings (dashboard blueprint)
CREATE TABLE IF NOT EXISTS public.msgf_user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('local', 'github')),
  display_name TEXT NOT NULL,
  local_path TEXT,
  github_url TEXT,
  repository_full_name TEXT,
  project_origin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_user_projects_origin_len CHECK (char_length(project_origin) <= 256),
  CONSTRAINT msgf_user_projects_user_origin_unique UNIQUE (user_id, project_origin)
);

CREATE INDEX IF NOT EXISTS msgf_user_projects_user_id_idx
  ON public.msgf_user_projects (user_id);

COMMENT ON TABLE public.msgf_user_projects IS
'Per-user local path or GitHub repository mappings for scoped dashboard and eco telemetry.';

ALTER TABLE public.msgf_user_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_user_projects_select_own ON public.msgf_user_projects;
CREATE POLICY msgf_user_projects_select_own ON public.msgf_user_projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS msgf_user_projects_insert_own ON public.msgf_user_projects;
CREATE POLICY msgf_user_projects_insert_own ON public.msgf_user_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS msgf_user_projects_update_own ON public.msgf_user_projects;
CREATE POLICY msgf_user_projects_update_own ON public.msgf_user_projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS msgf_user_projects_delete_own ON public.msgf_user_projects;
CREATE POLICY msgf_user_projects_delete_own ON public.msgf_user_projects
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.msgf_user_projects TO authenticated;
GRANT ALL ON public.msgf_user_projects TO service_role;

-- Per-user / per-project eco rollups (feeds authenticated dashboard)
CREATE TABLE IF NOT EXISTS msgf_master.user_project_eco_rollups (
  user_id UUID NOT NULL,
  project_origin TEXT NOT NULL,
  total_tokens_saved BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens_saved >= 0),
  total_grid_compute_prevented_kwh DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_grid_compute_prevented_kwh >= 0),
  total_co2e_offset_lbs DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_co2e_offset_lbs >= 0),
  total_freshwater_conserved_gallons DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_freshwater_conserved_gallons >= 0),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_origin)
);

COMMENT ON TABLE msgf_master.user_project_eco_rollups IS
'Cumulative Sustainable Compute rollups per signed-in user and project_origin tag.';

CREATE OR REPLACE FUNCTION public.msgf_master_increment_user_project_eco_rollup(
  p_user_id UUID,
  p_project_origin TEXT,
  p_tokens_saved BIGINT,
  p_grid_compute_prevented_kwh DOUBLE PRECISION,
  p_co2e_offset_lbs DOUBLE PRECISION,
  p_freshwater_conserved_gallons DOUBLE PRECISION,
  p_observed_at TIMESTAMPTZ
)
RETURNS TABLE (
  user_id UUID,
  project_origin TEXT,
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
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF p_project_origin IS NULL OR btrim(p_project_origin) = '' THEN
    RAISE EXCEPTION 'project_origin is required';
  END IF;
  IF p_tokens_saved < 0
    OR p_grid_compute_prevented_kwh < 0
    OR p_co2e_offset_lbs < 0
    OR p_freshwater_conserved_gallons < 0 THEN
    RAISE EXCEPTION 'eco rollup increments must be non-negative';
  END IF;

  RETURN QUERY
  INSERT INTO msgf_master.user_project_eco_rollups AS r (
    user_id,
    project_origin,
    total_tokens_saved,
    total_grid_compute_prevented_kwh,
    total_co2e_offset_lbs,
    total_freshwater_conserved_gallons,
    last_observed_at,
    updated_at
  )
  VALUES (
    p_user_id,
    btrim(p_project_origin),
    p_tokens_saved,
    p_grid_compute_prevented_kwh,
    p_co2e_offset_lbs,
    p_freshwater_conserved_gallons,
    COALESCE(p_observed_at, now()),
    now()
  )
  ON CONFLICT (user_id, project_origin)
  DO UPDATE SET
    total_tokens_saved = r.total_tokens_saved + EXCLUDED.total_tokens_saved,
    total_grid_compute_prevented_kwh =
      r.total_grid_compute_prevented_kwh + EXCLUDED.total_grid_compute_prevented_kwh,
    total_co2e_offset_lbs = r.total_co2e_offset_lbs + EXCLUDED.total_co2e_offset_lbs,
    total_freshwater_conserved_gallons =
      r.total_freshwater_conserved_gallons + EXCLUDED.total_freshwater_conserved_gallons,
    last_observed_at = GREATEST(r.last_observed_at, EXCLUDED.last_observed_at),
    updated_at = now()
  RETURNING
    r.user_id,
    r.project_origin,
    r.total_tokens_saved,
    r.total_grid_compute_prevented_kwh,
    r.total_co2e_offset_lbs,
    r.total_freshwater_conserved_gallons,
    r.last_observed_at;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON msgf_master.user_project_eco_rollups TO service_role;
GRANT EXECUTE ON FUNCTION public.msgf_master_increment_user_project_eco_rollup(
  UUID,
  TEXT,
  BIGINT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TIMESTAMPTZ
) TO service_role;
