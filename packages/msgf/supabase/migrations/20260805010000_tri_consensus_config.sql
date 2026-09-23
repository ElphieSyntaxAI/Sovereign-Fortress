-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
-- =============================================================================
-- Tri-consensus: allow xAI BYOK + per-tenant consensus preset config.

alter table public.msgf_tenant_provider_credentials
  drop constraint if exists msgf_tenant_provider_credentials_provider_check;

alter table public.msgf_tenant_provider_credentials
  add constraint msgf_tenant_provider_credentials_provider_check
  check (provider in ('gemini', 'anthropic', 'xai'));

comment on table public.msgf_tenant_provider_credentials is
  'Tenant Gemini / Anthropic / xAI API keys as AES-256-GCM (+ optional KMS-wrapped DEK) hex blobs; plaintext never stored.';

create table if not exists public.msgf_tenant_consensus_config (
  tenant_id text primary key,
  profile_id text not null default 'balanced_dual',
  mode text not null default 'DUAL',
  providers jsonb not null default '["anthropic","google"]'::jsonb,
  strictness text not null default 'UNANIMOUS',
  updated_at timestamptz not null default now(),
  constraint msgf_tenant_consensus_config_mode_check
    check (mode in ('DUAL', 'TRI', 'SOLO_FAST')),
  constraint msgf_tenant_consensus_config_strictness_check
    check (strictness in ('UNANIMOUS', 'MAJORITY')),
  constraint msgf_tenant_consensus_config_profile_check
    check (
      profile_id in (
        'balanced_dual',
        'bias_mitigated_dual',
        'gemini_grok_dual',
        'tri_tribunal',
        'custom_byok',
        'solo_fast'
      )
    )
);

comment on table public.msgf_tenant_consensus_config is
  'Small Brain CONVERGE preset per tenant (dual/tri/solo); Big Brain TRI is platform default when MSGF_TRI_CONSENSUS_ENABLED=1.';

alter table public.msgf_tenant_consensus_config enable row level security;

drop policy if exists "msgf_tenant_consensus_config_service_role_all"
  on public.msgf_tenant_consensus_config;

create policy "msgf_tenant_consensus_config_service_role_all"
  on public.msgf_tenant_consensus_config
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.msgf_tenant_consensus_config from public, anon, authenticated;
grant all on public.msgf_tenant_consensus_config to service_role;
