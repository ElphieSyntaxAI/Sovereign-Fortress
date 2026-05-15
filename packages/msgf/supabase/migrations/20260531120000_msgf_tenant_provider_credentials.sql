-- =============================================================================
-- Per-tenant provider API keys (Gemini / Anthropic BYOK). Stored encrypted only —
-- see packages/msgf/lib/crypto/CryptoService.ts and tenant-provider-credentials service.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_tenant_provider_credentials (
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msgf_tenant_provider_credentials_pk PRIMARY KEY (tenant_id, provider),
  CONSTRAINT msgf_tenant_provider_credentials_provider_check CHECK (
    provider IN ('gemini', 'anthropic')
  ),
  CONSTRAINT msgf_tenant_provider_credentials_hex_payload CHECK (
    char_length(encrypted_payload) >= 32
    AND encrypted_payload ~ '^[0-9a-fA-F]+$'
    AND char_length(encrypted_payload) % 2 = 0
  )
);

CREATE INDEX IF NOT EXISTS idx_msgf_tenant_provider_credentials_tenant
  ON public.msgf_tenant_provider_credentials (tenant_id);

COMMENT ON TABLE public.msgf_tenant_provider_credentials IS
  'Tenant Gemini / Anthropic API keys as AES-256-GCM (+ optional KMS-wrapped DEK) hex blobs; plaintext never stored.';

ALTER TABLE public.msgf_tenant_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_tenant_provider_credentials_service_role_all"
  ON public.msgf_tenant_provider_credentials;

CREATE POLICY "msgf_tenant_provider_credentials_service_role_all"
  ON public.msgf_tenant_provider_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_tenant_provider_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_tenant_provider_credentials TO service_role;
