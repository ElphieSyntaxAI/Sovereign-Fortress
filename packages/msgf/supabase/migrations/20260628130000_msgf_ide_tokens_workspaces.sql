-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
-- =============================================================================
-- P4 — Long-lived IDE tokens + registered workspaces (service-role only)

CREATE TABLE IF NOT EXISTS public.msgf_ide_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  label TEXT,
  workspace_fingerprint TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT msgf_ide_tokens_hash_unique UNIQUE (token_hash),
  CONSTRAINT msgf_ide_tokens_hash_format CHECK (
    char_length(token_hash) = 64 AND token_hash ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_msgf_ide_tokens_user_tenant
  ON public.msgf_ide_tokens (user_id, tenant_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msgf_ide_tokens_expires
  ON public.msgf_ide_tokens (expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.msgf_ide_tokens IS
  'Long-lived msgf_ide_* bearer tokens for IDE Pulse (hashed at rest).';

CREATE TABLE IF NOT EXISTS public.msgf_registered_workspaces (
  user_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  workspace_fingerprint TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_msgf_registered_workspaces_tenant
  ON public.msgf_registered_workspaces (tenant_id, last_seen_at DESC);

COMMENT ON TABLE public.msgf_registered_workspaces IS
  'IDE workspace registrations for tenant handoff and support.';

ALTER TABLE public.msgf_ide_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_registered_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_ide_tokens_service_role_all" ON public.msgf_ide_tokens;
CREATE POLICY "msgf_ide_tokens_service_role_all"
  ON public.msgf_ide_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "msgf_registered_workspaces_service_role_all" ON public.msgf_registered_workspaces;
CREATE POLICY "msgf_registered_workspaces_service_role_all"
  ON public.msgf_registered_workspaces FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.msgf_ide_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.msgf_registered_workspaces FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_ide_tokens TO service_role;
GRANT ALL ON public.msgf_registered_workspaces TO service_role;
