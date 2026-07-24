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
-- Atomic registration tail: profiles + legal_attestations + msgf_legacy_users in one transaction.
-- Preceding step: Supabase Auth createUser (TypeScript). On RPC failure, TS deletes the auth user.

CREATE OR REPLACE FUNCTION public.register_author_with_vault_pact(
  p_user_id UUID,
  p_display_name TEXT,
  p_username TEXT,
  p_email TEXT,
  p_password_hash TEXT,
  p_tier_id INT,
  p_vault_pact_content_sha256 TEXT,
  p_signature_text TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sig CONSTANT TEXT := 'I SIGN THE VAULT PACT';
BEGIN
  IF p_signature_text IS DISTINCT FROM v_sig THEN
    RAISE EXCEPTION 'invalid_vault_pact_signature' USING ERRCODE = 'P0001';
  END IF;

  IF p_vault_pact_content_sha256 IS NULL
     OR char_length(p_vault_pact_content_sha256) <> 64
     OR lower(p_vault_pact_content_sha256) !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_vault_pact_content_sha256' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'auth_user_missing' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(p_password_hash) <> 60 THEN
    RAISE EXCEPTION 'invalid_password_hash' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (p_user_id, NULLIF(trim(p_display_name), ''));

  INSERT INTO public.legal_attestations (
    user_id,
    doc_slug,
    content_hash,
    signature_text,
    metadata
  )
  VALUES (
    p_user_id,
    'vault-pact-bilateral',
    lower(p_vault_pact_content_sha256),
    v_sig,
    coalesce(p_metadata, '{}'::JSONB)
  );

  INSERT INTO public.msgf_legacy_users (
    user_id,
    username,
    email,
    tier_id,
    password_hash,
    user_role,
    preferred_theme
  )
  VALUES (
    p_user_id,
    p_username,
    p_email,
    p_tier_id,
    p_password_hash,
    'author',
    'Pleasure'
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_author_with_vault_pact(
  UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_author_with_vault_pact(
  UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION public.register_author_with_vault_pact IS
  'Single-transaction author row creation after Auth signup: profiles, Vault Pact attestation (SHA-256 hash), msgf_legacy_users.';
