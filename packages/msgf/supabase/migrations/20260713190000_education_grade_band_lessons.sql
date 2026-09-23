-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
-- =============================================================================
-- Grade-banded catalog + teacher lesson packages (Wave 2).

ALTER TABLE public.education_district_curriculum_catalog
  ADD COLUMN IF NOT EXISTS grade_band TEXT NOT NULL DEFAULT '4_6'
    CHECK (grade_band IN ('k3', '4_6', '7_9', '10_12', '12_plus', 'mixed'));

COMMENT ON COLUMN public.education_district_curriculum_catalog.grade_band IS
  'Target grade cohort for Layer A / teacher lesson filtering (admin upload by grade).';

CREATE INDEX IF NOT EXISTS idx_education_curriculum_catalog_grade
  ON public.education_district_curriculum_catalog (district_tenant_id, grade_band);

CREATE TABLE IF NOT EXISTS public.education_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  catalog_id UUID REFERENCES public.education_district_curriculum_catalog (id) ON DELETE SET NULL,
  resource_context_id UUID,
  milestone_template_id TEXT NOT NULL DEFAULT 'generic_sections',
  ai_allowance_level SMALLINT NOT NULL DEFAULT 3
    CHECK (ai_allowance_level >= 0 AND ai_allowance_level <= 4),
  require_reading_block BOOLEAN NOT NULL DEFAULT FALSE,
  classroom_course_id TEXT,
  google_doc_template_url TEXT,
  subject_domain TEXT NOT NULL DEFAULT 'general',
  grade_band TEXT NOT NULL DEFAULT '4_6',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_lessons_tenant
  ON public.education_lessons (tenant_id, created_at DESC);

COMMENT ON TABLE public.education_lessons IS
  'Teacher-built lesson packages: catalog slice + milestone template + AI allowance + optional Classroom/Doc link.';

ALTER TABLE public.education_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education_lessons_service_role" ON public.education_lessons;
CREATE POLICY "education_lessons_service_role"
  ON public.education_lessons FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.education_lessons FROM PUBLIC, anon;
GRANT ALL ON public.education_lessons TO service_role;
