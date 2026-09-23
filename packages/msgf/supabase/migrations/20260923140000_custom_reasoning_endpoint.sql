-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
-- =============================================================================
-- Custom reasoning endpoint (DeepSeek R1) beside Eco Trio slots.
ALTER TABLE public.msgf_tenant_consensus_config
  ADD COLUMN IF NOT EXISTS custom_reasoning_endpoint jsonb;

COMMENT ON COLUMN public.msgf_tenant_consensus_config.custom_reasoning_endpoint IS
  'Optional single custom endpoint for medium-drift reasoning (e.g. DeepSeek R1). Ciphertext apiKeyCipher only; public reads strip secrets.';
