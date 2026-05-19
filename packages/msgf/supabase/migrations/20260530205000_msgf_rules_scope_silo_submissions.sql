-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
-- =============================================================================
-- msgf_rules: GLOBAL vs LOCAL scope + disambiguation key for upserts.
-- Submissions: company admins propose elevating a local mitigation to platform-global rules.

ALTER TABLE public.msgf_rules
  ADD COLUMN IF NOT EXISTS rule_scope TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS rules_silo_key TEXT NOT NULL DEFAULT 'G';

UPDATE public.msgf_rules
SET
  rule_scope = 'GLOBAL',
  company_id = NULL,
  rules_silo_key = 'G'
WHERE rules_silo_key IS NULL OR rules_silo_key = '' OR rules_silo_key = 'G';

ALTER TABLE public.msgf_rules
  DROP CONSTRAINT IF EXISTS msgf_rules_rule_scope_check;
ALTER TABLE public.msgf_rules
  ADD CONSTRAINT msgf_rules_rule_scope_check
  CHECK (rule_scope IN ('GLOBAL', 'LOCAL'));

ALTER TABLE public.msgf_rules
  DROP CONSTRAINT IF EXISTS msgf_rules_scope_company_consistency;
ALTER TABLE public.msgf_rules
  ADD CONSTRAINT msgf_rules_scope_company_consistency
  CHECK (
    (rule_scope = 'GLOBAL' AND company_id IS NULL AND rules_silo_key = 'G')
    OR
    (rule_scope = 'LOCAL' AND company_id IS NOT NULL AND rules_silo_key = ('L:' || company_id::text))
  );

ALTER TABLE public.msgf_rules
  DROP CONSTRAINT IF EXISTS msgf_rules_tenant_namespace_key;

DROP INDEX IF EXISTS idx_msgf_rules_tenant_namespace_silo;
CREATE UNIQUE INDEX idx_msgf_rules_tenant_namespace_silo
  ON public.msgf_rules (tenant_id, rule_namespace, rule_key, rules_silo_key);

CREATE INDEX IF NOT EXISTS idx_msgf_rules_scope_company
  ON public.msgf_rules (tenant_id, rule_scope, company_id)
  WHERE rule_scope = 'LOCAL';

COMMENT ON COLUMN public.msgf_rules.rule_scope IS
  'GLOBAL = Brain-wide or tenant-wide core laws (not company-scoped). LOCAL = company-specific overlay.';
COMMENT ON COLUMN public.msgf_rules.company_id IS
  'Set when rule_scope = LOCAL; identifies the employer / org silo.';
COMMENT ON COLUMN public.msgf_rules.rules_silo_key IS
  'Upsert discriminator: G for GLOBAL rows, L:<uuid> for LOCAL company rows.';

-- ---------------------------------------------------------------------------
-- Global review queue (company admin submits local rule for platform promotion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.msgf_rule_global_review_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  company_id UUID NOT NULL,
  submitted_by_actor_id UUID,
  bug_index_instance TEXT NOT NULL,
  mitigation_snapshot JSONB NOT NULL,
  human_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending_global_review',
  reviewer_actor_id UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msgf_rule_submissions_status_check CHECK (status IN (
    'pending_global_review',
    'approved',
    'rejected',
    'withdrawn'
  ))
);

CREATE INDEX IF NOT EXISTS idx_msgf_rule_submissions_pending
  ON public.msgf_rule_global_review_submissions (status, created_at DESC)
  WHERE status = 'pending_global_review';

CREATE INDEX IF NOT EXISTS idx_msgf_rule_submissions_company
  ON public.msgf_rule_global_review_submissions (company_id, created_at DESC);

COMMENT ON TABLE public.msgf_rule_global_review_submissions IS
  'Company admins submit LOCAL global_mitigations for platform GLOBAL review + promotion.';

ALTER TABLE public.msgf_rule_global_review_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_rule_submissions_service_role_all" ON public.msgf_rule_global_review_submissions;
CREATE POLICY "msgf_rule_submissions_service_role_all"
  ON public.msgf_rule_global_review_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_rule_global_review_submissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_rule_global_review_submissions TO service_role;
