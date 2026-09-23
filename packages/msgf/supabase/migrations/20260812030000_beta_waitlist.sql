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
-- Beta / foundational testing waitlist (MSGF + Author + Education interest).

create table if not exists public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product in ('msgf', 'author', 'education')),
  email text not null,
  name text,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'invited', 'declined')),
  admin_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists beta_waitlist_product_email_unique
  on public.beta_waitlist (product, lower(email));

create index if not exists beta_waitlist_status_created_idx
  on public.beta_waitlist (status, created_at desc);

comment on table public.beta_waitlist is
  'Beta / foundational testing interest list. Operators review from MSGF admin ops.';

create or replace function public.beta_waitlist_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_beta_waitlist_updated_at on public.beta_waitlist;

create trigger trg_beta_waitlist_updated_at
  before update on public.beta_waitlist
  for each row
  execute function public.beta_waitlist_set_updated_at();

alter table public.beta_waitlist enable row level security;

drop policy if exists "beta_waitlist_service_role_all" on public.beta_waitlist;

create policy "beta_waitlist_service_role_all"
  on public.beta_waitlist
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.beta_waitlist from public;
revoke all on public.beta_waitlist from anon;
revoke all on public.beta_waitlist from authenticated;

grant all on public.beta_waitlist to service_role;
