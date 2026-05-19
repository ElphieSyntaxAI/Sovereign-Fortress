-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
-- =============================================================================
-- =============================================================================
-- Syntax Education — Layered workspace (grade_cohort + ai_allowance_level)
-- =============================================================================

ALTER TABLE public.education_privacy_vault
  ADD COLUMN IF NOT EXISTS grade_cohort TEXT NOT NULL DEFAULT '7_9';

COMMENT ON COLUMN public.education_privacy_vault.grade_cohort IS
  'Permanent Layer A cohort (k3, 4_6, 7_9, 10_12, 12_plus) — independent of ai_allowance_level.';

CREATE TABLE IF NOT EXISTS public.education_assignment_workspace (
  assignment_id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ai_allowance_level SMALLINT NOT NULL DEFAULT 3
    CHECK (ai_allowance_level >= 0 AND ai_allowance_level <= 4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_education_assignment_workspace_tenant
  ON public.education_assignment_workspace (tenant_id);

COMMENT ON TABLE public.education_assignment_workspace IS
  'Layer B — teacher-controlled ai_allowance_level per assignment (0–4).';

ALTER TABLE public.education_assignment_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education_assignment_workspace_service_role" ON public.education_assignment_workspace;
CREATE POLICY "education_assignment_workspace_service_role"
  ON public.education_assignment_workspace FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.education_assignment_workspace FROM PUBLIC, anon;
GRANT ALL ON public.education_assignment_workspace TO service_role;
