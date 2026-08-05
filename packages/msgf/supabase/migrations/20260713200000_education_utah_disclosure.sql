-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
-- =============================================================================
-- Utah S.B. 149 disclosure attestations + instance columns (H.B. 273 companion gates).

CREATE TABLE IF NOT EXISTS public.education_disclosure_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_token TEXT NOT NULL,
  assignment_instance_id UUID,
  assignment_id UUID,
  legal_version TEXT NOT NULL,
  policy_id TEXT NOT NULL DEFAULT 'utah_sb149_hb273',
  acknowledgement_text_hash TEXT NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_education_disclosure_entity_version
  ON public.education_disclosure_attestations (tenant_id, entity_token, legal_version);

CREATE INDEX IF NOT EXISTS idx_education_disclosure_tenant_time
  ON public.education_disclosure_attestations (tenant_id, attested_at DESC);

COMMENT ON TABLE public.education_disclosure_attestations IS
  'Utah S.B. 149 AI disclosure acceptances — required before AI/telemetry processing.';

ALTER TABLE public.education_disclosure_attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education_disclosure_attestations_service_role"
  ON public.education_disclosure_attestations;
CREATE POLICY "education_disclosure_attestations_service_role"
  ON public.education_disclosure_attestations FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.education_disclosure_attestations FROM PUBLIC, anon;
GRANT ALL ON public.education_disclosure_attestations TO service_role;

ALTER TABLE public.education_assignment_instances
  ADD COLUMN IF NOT EXISTS utah_disclosure_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS utah_disclosure_legal_version TEXT;

COMMENT ON COLUMN public.education_assignment_instances.utah_disclosure_accepted_at IS
  'When the student accepted S.B. 149 disclosure for this instance path.';
