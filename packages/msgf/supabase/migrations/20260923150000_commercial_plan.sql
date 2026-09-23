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
-- Commercial plan entitlements (BYOK / Pro / Startup / Enterprise).

alter table public.msgf_companies
  add column if not exists commercial_plan text not null default 'byok';

alter table public.p4_profiles
  add column if not exists commercial_plan text not null default 'byok';

alter table public.msgf_companies
  drop constraint if exists msgf_companies_commercial_plan_check;

alter table public.msgf_companies
  add constraint msgf_companies_commercial_plan_check
  check (commercial_plan in ('byok', 'pro', 'startup', 'enterprise'));

alter table public.p4_profiles
  drop constraint if exists p4_profiles_commercial_plan_check;

alter table public.p4_profiles
  add constraint p4_profiles_commercial_plan_check
  check (commercial_plan in ('byok', 'pro', 'startup', 'enterprise'));

comment on column public.msgf_companies.commercial_plan is
  'Sold commercial plan for the workspace: byok | pro | startup | enterprise.';

comment on column public.p4_profiles.commercial_plan is
  'Sold commercial plan for the profile when not on a company workspace.';
