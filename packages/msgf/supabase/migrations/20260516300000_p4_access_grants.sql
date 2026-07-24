-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
-- =============================================================================
-- Publisher / editor shareable read-only grants (opaque token, hashed at rest).

CREATE TABLE IF NOT EXISTS public.p4_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  /** SHA-256 hex (or base64) of the raw token shown in the URL — never store the raw token. */
  token TEXT NOT NULL,
  level INT NOT NULL CHECK (level >= 1 AND level <= 4),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** First successful public verify (used for one-time author notification). */
  first_access_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_p4_access_grants_token_unique ON public.p4_access_grants (token);

CREATE INDEX IF NOT EXISTS idx_p4_access_grants_manuscript_created
  ON public.p4_access_grants (manuscript_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p4_access_grants_tenant_expires
  ON public.p4_access_grants (tenant_id, expires_at DESC);

COMMENT ON TABLE public.p4_access_grants IS
  'Time-boxed publisher preview links; token column stores hash only. Level 4 may reveal manuscript body on verify UI.';

ALTER TABLE public.p4_access_grants ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: grant lifecycle uses service role from trusted APIs only.
