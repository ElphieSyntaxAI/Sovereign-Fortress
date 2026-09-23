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
-- Eco Trio custom endpoints live beside the metered providers array.

alter table public.msgf_tenant_consensus_config
  add column if not exists custom_eco_endpoints jsonb;

comment on column public.msgf_tenant_consensus_config.custom_eco_endpoints is
  'Eco Trio SLM endpoints for this project row. Null on metered presets. providers stays a string array.';

alter table public.msgf_tenant_consensus_config
  drop constraint if exists msgf_tenant_consensus_config_profile_check;

alter table public.msgf_tenant_consensus_config
  add constraint msgf_tenant_consensus_config_profile_check
  check (
    profile_id in (
      'balanced_dual',
      'bias_mitigated_dual',
      'gemini_grok_dual',
      'tri_tribunal',
      'custom_byok',
      'solo_fast',
      'eco_trio'
    )
  );
