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
-- Adaptive HAL biometric baseline per user.
create table if not exists public.biometric_profile (
  user_id text primary key,
  ewma_speed double precision,
  rhythm_hash text,
  recalibrated_at timestamptz,
  baseline_training_remaining integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_biometric_profile_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_biometric_profile_updated_at on public.biometric_profile;
create trigger trg_biometric_profile_updated_at
before update on public.biometric_profile
for each row
execute function public.set_biometric_profile_updated_at();

alter table public.biometric_profile enable row level security;

drop policy if exists "biometric_profile_select_own" on public.biometric_profile;
create policy "biometric_profile_select_own"
  on public.biometric_profile for select
  to authenticated
  using (user_id = (select auth.uid()::text));

drop policy if exists "biometric_profile_insert_own" on public.biometric_profile;
create policy "biometric_profile_insert_own"
  on public.biometric_profile for insert
  to authenticated
  with check (user_id = (select auth.uid()::text));

drop policy if exists "biometric_profile_update_own" on public.biometric_profile;
create policy "biometric_profile_update_own"
  on public.biometric_profile for update
  to authenticated
  using (user_id = (select auth.uid()::text))
  with check (user_id = (select auth.uid()::text));
