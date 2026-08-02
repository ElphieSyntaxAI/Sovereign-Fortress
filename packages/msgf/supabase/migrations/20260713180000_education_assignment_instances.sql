-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
-- =============================================================================
-- Syntax Education — assignment instances (Author manuscript states → edu lifecycle)
-- HAL Lite metrics, Classroom linkage, Turn-In Lockout (EDU_SUBMITTED_LOCK).

CREATE TABLE IF NOT EXISTS public.education_assignment_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  assignment_id UUID NOT NULL,
  entity_token TEXT NOT NULL,
  classroom_course_id TEXT,
  classroom_course_work_id TEXT,
  resource_context_id TEXT,
  milestone_template_id TEXT NOT NULL DEFAULT 'generic_sections',
  current_state TEXT NOT NULL DEFAULT 'EDU_ACTIVE_DRAFTING'
    CHECK (current_state IN (
      'EDU_ACTIVE_DRAFTING',
      'EDU_MILESTONE_CHECKING',
      'EDU_SUBMITTED_LOCK'
    )),
  document_read_only BOOLEAN NOT NULL DEFAULT FALSE,
  hal_lite_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_education_assignment_instance_entity
  ON public.education_assignment_instances (tenant_id, assignment_id, entity_token);

CREATE INDEX IF NOT EXISTS idx_education_assignment_instances_assignment
  ON public.education_assignment_instances (tenant_id, assignment_id);

CREATE INDEX IF NOT EXISTS idx_education_assignment_instances_state
  ON public.education_assignment_instances (tenant_id, current_state);

COMMENT ON TABLE public.education_assignment_instances IS
  'Per-student assignment lifecycle: EDU_ACTIVE_DRAFTING | EDU_MILESTONE_CHECKING | EDU_SUBMITTED_LOCK. Maps Author STATE_SOVEREIGN / STATE_AUDIT / STATE_COOLDOWN.';

COMMENT ON COLUMN public.education_assignment_instances.hal_lite_metrics IS
  'HAL Lite Human Effort Signal: activeWritingTimeSeconds, pasteEventsCount, humanEffortConfidenceScore, etc.';

ALTER TABLE public.education_assignment_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education_assignment_instances_service_role"
  ON public.education_assignment_instances;
CREATE POLICY "education_assignment_instances_service_role"
  ON public.education_assignment_instances FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.education_assignment_instances FROM PUBLIC, anon;
GRANT ALL ON public.education_assignment_instances TO service_role;
