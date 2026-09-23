-- Custom reasoning endpoint (DeepSeek R1) beside Eco Trio slots.
ALTER TABLE public.msgf_tenant_consensus_config
  ADD COLUMN IF NOT EXISTS custom_reasoning_endpoint jsonb;

COMMENT ON COLUMN public.msgf_tenant_consensus_config.custom_reasoning_endpoint IS
  'Optional single custom endpoint for medium-drift reasoning (e.g. DeepSeek R1). Ciphertext apiKeyCipher only; public reads strip secrets.';
