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
-- =============================================================================
-- I1: Company Workspace domains, signing provider flag, invite onboarding_status,
--     signing envelope provider columns (DocuSign remains default).
-- =============================================================================

-- Google Workspace allowlist (hd / email domain → company)
CREATE TABLE IF NOT EXISTS public.msgf_company_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_company_domains_domain_lower CHECK (domain = lower(domain)),
  CONSTRAINT msgf_company_domains_not_consumer CHECK (
    domain NOT IN ('gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com')
  ),
  CONSTRAINT msgf_company_domains_unique UNIQUE (company_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_msgf_company_domains_domain
  ON public.msgf_company_domains (domain);

COMMENT ON TABLE public.msgf_company_domains IS
  'Allowed Google Workspace email domains per company (SSO hd allowlist).';

ALTER TABLE public.msgf_company_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_company_domains_service_role_all ON public.msgf_company_domains;
CREATE POLICY msgf_company_domains_service_role_all
  ON public.msgf_company_domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated: members of the company may read; writes via service_role / admin APIs
DROP POLICY IF EXISTS msgf_company_domains_select_member ON public.msgf_company_domains;
CREATE POLICY msgf_company_domains_select_member
  ON public.msgf_company_domains
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id
      FROM public.p4_profiles p
      WHERE p.user_id = auth.uid()
        AND p.company_id IS NOT NULL
    )
  );

GRANT SELECT ON public.msgf_company_domains TO authenticated;
GRANT ALL ON public.msgf_company_domains TO service_role;

-- Company signing + Dropbox archive prefs
ALTER TABLE public.msgf_companies
  ADD COLUMN IF NOT EXISTS signing_provider TEXT NOT NULL DEFAULT 'docusign'
    CHECK (signing_provider IN ('docusign', 'dropbox_sign')),
  ADD COLUMN IF NOT EXISTS dropbox_archive_path TEXT;

COMMENT ON COLUMN public.msgf_companies.signing_provider IS
  'Feature flag: docusign (default) or dropbox_sign via SigningProvider abstraction.';

-- Invite onboarding lifecycle (signing gate for IDE mint)
ALTER TABLE public.msgf_team_invites
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'PENDING_INVITE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'msgf_team_invites_onboarding_status_check'
  ) THEN
    ALTER TABLE public.msgf_team_invites
      ADD CONSTRAINT msgf_team_invites_onboarding_status_check
      CHECK (onboarding_status IN (
        'PENDING_INVITE',
        'PENDING_SIGNATURE',
        'APPROVED',
        'REJECTED'
      ));
  END IF;
END $$;

-- Backfill: accepted invites → APPROVED; pending → PENDING_INVITE
UPDATE public.msgf_team_invites
SET onboarding_status = CASE
  WHEN status = 'accepted' THEN 'APPROVED'
  WHEN status = 'revoked' THEN 'REJECTED'
  ELSE 'PENDING_INVITE'
END
WHERE onboarding_status = 'PENDING_INVITE'
  AND status IN ('accepted', 'revoked');

-- Envelope provider-agnostic columns (keep table name for DocuSign compat)
ALTER TABLE public.msgf_docusign_envelopes
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'docusign'
    CHECK (provider IN ('docusign', 'dropbox_sign')),
  ADD COLUMN IF NOT EXISTS external_request_id TEXT,
  ADD COLUMN IF NOT EXISTS signed_pdf_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS dropbox_file_id TEXT;

UPDATE public.msgf_docusign_envelopes
SET external_request_id = envelope_id
WHERE external_request_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_msgf_docusign_envelopes_provider_ext
  ON public.msgf_docusign_envelopes (provider, external_request_id);
