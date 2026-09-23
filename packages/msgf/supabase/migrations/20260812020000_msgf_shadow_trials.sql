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
-- Free 24h Shadow Proxy trials — mint msgf_test_* keys + status token for live savings.

alter table public.msgf_licenses
  add column if not exists expires_at timestamptz;

comment on column public.msgf_licenses.expires_at is
  'Optional hard expiry (Shadow Proxy trials). Gateway rejects active keys past this timestamp.';

create index if not exists idx_msgf_licenses_expires_at
  on public.msgf_licenses (expires_at)
  where expires_at is not null;

create table if not exists public.msgf_shadow_trials (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  tenant_id text not null,
  license_id uuid not null references public.msgf_licenses (id) on delete cascade,
  status_token_hash text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  report_sent_at timestamptz,
  welcome_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint msgf_shadow_trials_status_token_hash_format check (
    char_length(status_token_hash) = 64
    and status_token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint msgf_shadow_trials_tenant_id_unique unique (tenant_id),
  constraint msgf_shadow_trials_status_token_hash_unique unique (status_token_hash)
);

create index if not exists idx_msgf_shadow_trials_email
  on public.msgf_shadow_trials (lower(email));

create index if not exists idx_msgf_shadow_trials_expires_report
  on public.msgf_shadow_trials (expires_at)
  where report_sent_at is null;

comment on table public.msgf_shadow_trials is
  'Marketing Shadow Proxy trials. Plaintext msgf_test key shown once at signup; status page uses hashed token.';

alter table public.msgf_shadow_trials enable row level security;

drop policy if exists "msgf_shadow_trials_service_role_all" on public.msgf_shadow_trials;

create policy "msgf_shadow_trials_service_role_all"
  on public.msgf_shadow_trials
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.msgf_shadow_trials from public;
revoke all on public.msgf_shadow_trials from anon;
revoke all on public.msgf_shadow_trials from authenticated;

grant all on public.msgf_shadow_trials to service_role;
