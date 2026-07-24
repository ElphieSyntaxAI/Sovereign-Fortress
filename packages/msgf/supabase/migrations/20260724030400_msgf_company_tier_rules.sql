-- =============================================================================
-- Part B2: Company path → forced CONVERGE tier rules.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_company_tier_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.msgf_companies(id) ON DELETE CASCADE,
  path_glob TEXT NOT NULL,
  force_tier TEXT NOT NULL CHECK (force_tier IN ('TIER_1', 'TIER_2', 'TIER_3')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_company_tier_rules_glob_len CHECK (char_length(path_glob) <= 512)
);

CREATE INDEX IF NOT EXISTS idx_msgf_company_tier_rules_company
  ON public.msgf_company_tier_rules (company_id)
  WHERE enabled = true;

COMMENT ON TABLE public.msgf_company_tier_rules IS
  'Part B2: COMPANY_ADMIN path globs that force CONVERGE tier (e.g. /payment/** → TIER_3).';

ALTER TABLE public.msgf_company_tier_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_company_tier_rules_service_role_all ON public.msgf_company_tier_rules;
CREATE POLICY msgf_company_tier_rules_service_role_all
  ON public.msgf_company_tier_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_company_tier_rules FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_company_tier_rules TO service_role;
