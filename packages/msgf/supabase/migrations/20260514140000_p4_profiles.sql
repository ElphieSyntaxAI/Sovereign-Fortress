-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
-- =============================================================================
-- Canonical app profile keyed by Supabase Auth, with optional legacy UUID mapping (post-migration).
create table if not exists public.p4_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  legacy_user_id uuid unique,
  username text not null,
  tier_id integer references public.msgf_legacy_tiers (tier_id) on delete set null,
  user_role text not null default 'fan',
  preferred_theme text not null default 'Pleasure',
  migrated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_p4_profiles_legacy_user_id on public.p4_profiles (legacy_user_id);

alter table public.p4_profiles enable row level security;

create policy "p4_profiles_select_own"
  on public.p4_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "p4_profiles_update_own"
  on public.p4_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.p4_profiles is 'App profile + legacy user_id mapping after auth.admin migration from msgf_legacy_users.';
