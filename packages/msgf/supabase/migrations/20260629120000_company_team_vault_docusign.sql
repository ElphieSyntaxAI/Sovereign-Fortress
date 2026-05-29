-- Company team management, tenant vault onboarding, DocuSign compliance tracking

CREATE TABLE IF NOT EXISTS public.msgf_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.msgf_company_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  project_origin TEXT NOT NULL,
  local_path TEXT,
  github_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_company_projects_origin_len CHECK (char_length(project_origin) <= 256),
  CONSTRAINT msgf_company_projects_unique UNIQUE (company_id, project_origin)
);

CREATE INDEX IF NOT EXISTS idx_msgf_company_projects_company
  ON public.msgf_company_projects (company_id);

ALTER TABLE public.p4_profiles
  ADD COLUMN IF NOT EXISTS team_platform_role TEXT
    CHECK (team_platform_role IS NULL OR team_platform_role IN ('admin', 'security', 'auditor', 'dev')),
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'pending_signatures'));

CREATE TABLE IF NOT EXISTS public.msgf_team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  team_platform_role TEXT NOT NULL CHECK (team_platform_role IN ('admin', 'security', 'auditor', 'dev')),
  project_origins TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msgf_team_invites_company
  ON public.msgf_team_invites (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_team_invites_email
  ON public.msgf_team_invites (lower(email), status);

CREATE TABLE IF NOT EXISTS public.msgf_user_project_assignments (
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  project_origin TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id, project_origin)
);

CREATE TABLE IF NOT EXISTS public.msgf_tenant_vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('custom_pdf', 'pillar_guide', 'architecture_template', 'docusign_completed')),
  display_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_digest TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msgf_tenant_vault_documents_company
  ON public.msgf_tenant_vault_documents (company_id);

CREATE TABLE IF NOT EXISTS public.msgf_invite_onboarding_bundles (
  invite_id UUID PRIMARY KEY REFERENCES public.msgf_team_invites (id) ON DELETE CASCADE,
  include_pillar_guide BOOLEAN NOT NULL DEFAULT false,
  include_architecture_template BOOLEAN NOT NULL DEFAULT false,
  enforce_docusign BOOLEAN NOT NULL DEFAULT false,
  custom_document_ids UUID[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.msgf_user_onboarding_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.msgf_tenant_vault_documents (id) ON DELETE CASCADE,
  invite_id UUID REFERENCES public.msgf_team_invites (id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  UNIQUE (user_id, document_id)
);

CREATE TABLE IF NOT EXISTS public.msgf_docusign_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.msgf_team_invites (id) ON DELETE CASCADE,
  user_id UUID,
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  envelope_id TEXT NOT NULL,
  signing_url TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'completed', 'declined')),
  completed_at TIMESTAMPTZ,
  connect_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msgf_docusign_envelopes_envelope
  ON public.msgf_docusign_envelopes (envelope_id);

CREATE TABLE IF NOT EXISTS public.msgf_tenant_vault_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.msgf_companies (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.msgf_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_company_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_user_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_tenant_vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_invite_onboarding_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_user_onboarding_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_docusign_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_tenant_vault_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.msgf_companies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_company_projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_team_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_user_project_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_tenant_vault_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_invite_onboarding_bundles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_user_onboarding_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_docusign_envelopes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_tenant_vault_log FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.msgf_companies TO service_role;
GRANT ALL ON public.msgf_company_projects TO service_role;
GRANT ALL ON public.msgf_team_invites TO service_role;
GRANT ALL ON public.msgf_user_project_assignments TO service_role;
GRANT ALL ON public.msgf_tenant_vault_documents TO service_role;
GRANT ALL ON public.msgf_invite_onboarding_bundles TO service_role;
GRANT ALL ON public.msgf_user_onboarding_grants TO service_role;
GRANT ALL ON public.msgf_docusign_envelopes TO service_role;
GRANT ALL ON public.msgf_tenant_vault_log TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-vault',
  'tenant-vault',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;
