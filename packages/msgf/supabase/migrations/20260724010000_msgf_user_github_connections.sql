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
-- Per-user GitHub OAuth access tokens for Setup → Projects repo picker.
-- Tokens are stored encrypted only (CRYPTO_SECRET_KEY / KMS via CryptoService).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_user_github_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  encrypted_access_token TEXT NOT NULL,
  github_login TEXT,
  scopes TEXT NOT NULL DEFAULT 'read:user repo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.msgf_user_github_connections IS
  'Encrypted GitHub provider_token per MSGF user for listing repos on Setup → Projects.';

CREATE INDEX IF NOT EXISTS msgf_user_github_connections_login_idx
  ON public.msgf_user_github_connections (github_login);

ALTER TABLE public.msgf_user_github_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_user_github_connections_select_own ON public.msgf_user_github_connections;
CREATE POLICY msgf_user_github_connections_select_own ON public.msgf_user_github_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS msgf_user_github_connections_insert_own ON public.msgf_user_github_connections;
CREATE POLICY msgf_user_github_connections_insert_own ON public.msgf_user_github_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS msgf_user_github_connections_update_own ON public.msgf_user_github_connections;
CREATE POLICY msgf_user_github_connections_update_own ON public.msgf_user_github_connections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS msgf_user_github_connections_delete_own ON public.msgf_user_github_connections;
CREATE POLICY msgf_user_github_connections_delete_own ON public.msgf_user_github_connections
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.msgf_user_github_connections TO authenticated;
GRANT ALL ON public.msgf_user_github_connections TO service_role;
