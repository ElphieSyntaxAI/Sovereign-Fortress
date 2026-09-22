-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
-- =============================================================================
-- Tenant Small Brain default AI provider (SOLO_FAST lead) alongside dual/TRI pair.

alter table public.msgf_tenant_consensus_config
  add column if not exists default_provider text not null default 'google';

update public.msgf_tenant_consensus_config
set default_provider = case
  when providers ->> 0 in ('anthropic', 'google', 'xai') then providers ->> 0
  else 'google'
end
where default_provider is null
   or (
     default_provider = 'google'
     and providers ->> 0 in ('anthropic', 'xai')
   );

alter table public.msgf_tenant_consensus_config
  drop constraint if exists msgf_tenant_consensus_config_default_provider_check;

alter table public.msgf_tenant_consensus_config
  add constraint msgf_tenant_consensus_config_default_provider_check
  check (default_provider in ('anthropic', 'google', 'xai'));

comment on column public.msgf_tenant_consensus_config.default_provider is
  'Small Brain lead / SOLO_FAST provider (google=Gemini, anthropic=Claude, xai=Grok). Must be present in providers[].';
