-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
-- =============================================================================
-- legal_attestations: immutable-ish record of Vault Pact / legal doc signatures at registration or in-product.
-- user_id -> public.profiles.id (same UUID as auth.users primary key in this stack).

CREATE TABLE IF NOT EXISTS public.legal_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  doc_slug TEXT NOT NULL,
  content_hash TEXT NOT NULL
    CHECK (char_length(content_hash) = 64 AND content_hash ~ '^[0-9a-fA-F]{64}$'),
  signature_text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legal_attestations_signature_vault_pact_chk CHECK (signature_text = 'I SIGN THE VAULT PACT')
);

CREATE INDEX IF NOT EXISTS idx_legal_attestations_user_created
  ON public.legal_attestations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_attestations_doc_slug
  ON public.legal_attestations (doc_slug);

CREATE INDEX IF NOT EXISTS idx_legal_attestations_content_hash
  ON public.legal_attestations (content_hash);

COMMENT ON TABLE public.legal_attestations IS
  'Legal attestations: SHA-256 of signed markdown, exact signature text, client metadata (e.g. ip_hash, user_agent, browser_fingerprint in JSONB).';

COMMENT ON COLUMN public.legal_attestations.doc_slug IS
  'Stable document id, e.g. vault-pact-bilateral, author-nda.';

COMMENT ON COLUMN public.legal_attestations.content_hash IS
  'SHA-256 (64 hex chars) of the UTF-8 markdown bytes the user attested to.';

COMMENT ON COLUMN public.legal_attestations.metadata IS
  'Suggested keys: ip_hash (hashed client IP), user_agent, browser_fingerprint. Do not store raw IP if policy requires hashing only.';

ALTER TABLE public.legal_attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_attestations_select_own" ON public.legal_attestations;
CREATE POLICY "legal_attestations_select_own"
  ON public.legal_attestations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "legal_attestations_insert_own" ON public.legal_attestations;
CREATE POLICY "legal_attestations_insert_own"
  ON public.legal_attestations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE by default: append-only audit posture (service_role can still DDL if needed).

GRANT SELECT, INSERT ON public.legal_attestations TO authenticated;
GRANT ALL ON public.legal_attestations TO service_role;
