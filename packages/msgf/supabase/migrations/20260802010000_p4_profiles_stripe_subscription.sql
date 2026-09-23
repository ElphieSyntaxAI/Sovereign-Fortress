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
-- M3 Stripe entitlement lookup keys + Startup Team seat allocation.

alter table public.p4_profiles
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text;

create index if not exists idx_p4_profiles_stripe_subscription_id
  on public.p4_profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_p4_profiles_stripe_customer_id
  on public.p4_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.p4_profiles.stripe_subscription_id is
  'Stripe subscription id for monthly/startup plans — used by webhook lifecycle events.';

comment on column public.p4_profiles.stripe_customer_id is
  'Stripe customer id mirror for invoice / subscription lookups.';

alter table public.msgf_companies
  add column if not exists seat_limit integer not null default 1,
  add column if not exists stripe_subscription_id text;

alter table public.msgf_companies
  drop constraint if exists msgf_companies_seat_limit_positive;

alter table public.msgf_companies
  add constraint msgf_companies_seat_limit_positive
  check (seat_limit >= 1);

create index if not exists idx_msgf_companies_stripe_subscription_id
  on public.msgf_companies (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.msgf_companies.seat_limit is
  'Purchased Startup Team seat quantity from Stripe Checkout line_items quantity.';

comment on column public.msgf_companies.stripe_subscription_id is
  'Stripe subscription id linked to this company workspace seat pool.';
