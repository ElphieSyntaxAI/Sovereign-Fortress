-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
-- =============================================================================
-- M3 commercial entitlements on canonical app profile (Pulse / Brain gating).

alter table public.p4_profiles
  add column if not exists current_credits integer not null default 0,
  add column if not exists stripe_subscription_status text,
  add column if not exists billing_license_type text not null default 'monthly';

alter table public.p4_profiles
  drop constraint if exists p4_profiles_billing_license_type_check;

alter table public.p4_profiles
  add constraint p4_profiles_billing_license_type_check
  check (billing_license_type in ('free', 'monthly', 'lifetime'));

alter table public.p4_profiles
  drop constraint if exists p4_profiles_current_credits_non_negative;

alter table public.p4_profiles
  add constraint p4_profiles_current_credits_non_negative
  check (current_credits >= 0);

comment on column public.p4_profiles.current_credits is
  'P3 update credits (lifetime license); decremented on consensus / self-heal.';

comment on column public.p4_profiles.stripe_subscription_status is
  'Stripe subscription status mirror (e.g. active, past_due, canceled). Set by webhook when live.';

comment on column public.p4_profiles.billing_license_type is
  'Hybrid license: free | monthly (Stripe) | lifetime (credit wallet).';
