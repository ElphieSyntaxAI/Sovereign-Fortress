-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
-- =============================================================================
-- =============================================================================
-- Syntax Education — Canvas LTI 1.3 (P3 Entity Profiles) + Privacy Vault + AGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.education_lti_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  deployment_id TEXT NOT NULL,
  platform_auth_url TEXT NOT NULL,
  platform_token_url TEXT NOT NULL,
  platform_jwks_url TEXT NOT NULL,
  tool_launch_url TEXT NOT NULL,
  tool_login_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT education_lti_deployments_unique UNIQUE (issuer, client_id, deployment_id)
);

COMMENT ON TABLE public.education_lti_deployments IS
  'Canvas / LMS LTI 1.3 deployment registry (P3).';

CREATE TABLE IF NOT EXISTS public.education_privacy_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_id UUID NOT NULL,
  anonymous_display_token TEXT NOT NULL,
  canvas_sub_hash TEXT NOT NULL,
  lti_role TEXT NOT NULL DEFAULT 'student',
  deployment_id TEXT NOT NULL,
  issuer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT education_privacy_vault_entity_unique UNIQUE (tenant_id, entity_id),
  CONSTRAINT education_privacy_vault_sub_unique UNIQUE (tenant_id, canvas_sub_hash, deployment_id),
  CONSTRAINT education_privacy_vault_token_unique UNIQUE (tenant_id, anonymous_display_token)
);

COMMENT ON TABLE public.education_privacy_vault IS
  'P3 Cryptographic Privacy Gate — de-identified student tokens only; no legal names or emails.';

CREATE INDEX IF NOT EXISTS idx_education_privacy_vault_tenant_token
  ON public.education_privacy_vault (tenant_id, anonymous_display_token);

CREATE TABLE IF NOT EXISTS public.education_lti_launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_id UUID NOT NULL,
  privacy_vault_id UUID NOT NULL REFERENCES public.education_privacy_vault (id) ON DELETE CASCADE,
  deployment_id TEXT NOT NULL,
  context_id TEXT,
  resource_link_id TEXT,
  line_items_url TEXT,
  line_item_url TEXT,
  scores_url TEXT,
  roles JSONB NOT NULL DEFAULT '[]'::JSONB,
  launch_claims JSONB NOT NULL DEFAULT '{}'::JSONB,
  /** Canvas `sub` — server-side AGS only; never shown in de-identified dashboards. */
  canvas_ags_user_ref TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_lti_launches_entity
  ON public.education_lti_launches (tenant_id, entity_id, created_at DESC);

COMMENT ON TABLE public.education_lti_launches IS
  'Ephemeral LTI launch context (AGS endpoints, resource link) — PII stripped at ingest.';

CREATE TABLE IF NOT EXISTS public.education_human_effort_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_id UUID NOT NULL,
  privacy_vault_id UUID NOT NULL REFERENCES public.education_privacy_vault (id) ON DELETE CASCADE,
  resource_link_id TEXT,
  line_item_url TEXT NOT NULL,
  hal_score NUMERIC(5, 2) NOT NULL CHECK (hal_score >= 0 AND hal_score <= 100),
  certificate_digest TEXT NOT NULL,
  teacher_dashboard_url TEXT NOT NULL,
  ags_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ags_status IN ('pending', 'submitted', 'failed')),
  ags_error TEXT,
  ags_submitted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_hec_entity
  ON public.education_human_effort_certificates (tenant_id, entity_id, created_at DESC);

COMMENT ON TABLE public.education_human_effort_certificates IS
  'Human Effort Certificate (HAL) — AGS pass-back payload anchor for Canvas SpeedGrader.';

ALTER TABLE public.education_lti_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_privacy_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_lti_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_human_effort_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "education_lti_service_role_all" ON public.education_lti_deployments;
CREATE POLICY "education_lti_service_role_all"
  ON public.education_lti_deployments FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "education_privacy_vault_service_role_all" ON public.education_privacy_vault;
CREATE POLICY "education_privacy_vault_service_role_all"
  ON public.education_privacy_vault FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "education_lti_launches_service_role_all" ON public.education_lti_launches;
CREATE POLICY "education_lti_launches_service_role_all"
  ON public.education_lti_launches FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "education_hec_service_role_all" ON public.education_human_effort_certificates;
CREATE POLICY "education_hec_service_role_all"
  ON public.education_human_effort_certificates FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.education_lti_deployments FROM PUBLIC, anon;
REVOKE ALL ON public.education_privacy_vault FROM PUBLIC, anon;
REVOKE ALL ON public.education_lti_launches FROM PUBLIC, anon;
REVOKE ALL ON public.education_human_effort_certificates FROM PUBLIC, anon;

GRANT ALL ON public.education_lti_deployments TO service_role;
GRANT ALL ON public.education_privacy_vault TO service_role;
GRANT ALL ON public.education_lti_launches TO service_role;
GRANT ALL ON public.education_human_effort_certificates TO service_role;
