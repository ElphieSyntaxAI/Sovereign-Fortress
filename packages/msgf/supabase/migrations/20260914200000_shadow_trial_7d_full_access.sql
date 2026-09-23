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
-- 7-day Shadow Proxy clock (starts on first eval) + 3-day Individual Pro full access.

alter table public.msgf_shadow_trials
  add column if not exists first_eval_at timestamptz,
  add column if not exists activation_expires_at timestamptz,
  add column if not exists full_access_started_at timestamptz,
  add column if not exists full_access_expires_at timestamptz,
  add column if not exists full_access_user_id uuid;

comment on column public.msgf_shadow_trials.first_eval_at is
  'Set on first Shadow Eval. Starts the 7-day proof window. Null = unused key.';

comment on column public.msgf_shadow_trials.activation_expires_at is
  'Unused-key deadline (signup + 14 days). Distinct from the 7-day eval window.';

comment on column public.msgf_shadow_trials.full_access_started_at is
  'When the sequential 3-day Individual Pro trial was granted. One grant per email.';

comment on column public.msgf_shadow_trials.full_access_expires_at is
  'End of 72h Individual Pro full access (dashboard, Pulse, IDE token, Active).';

comment on column public.msgf_shadow_trials.full_access_user_id is
  'Auth user bound after magic-link login for the 3-day full-access window.';

-- In-flight 24h rows already started their clock at signup — keep expires_at.
update public.msgf_shadow_trials
set
  first_eval_at = coalesce(first_eval_at, started_at),
  activation_expires_at = coalesce(activation_expires_at, started_at + interval '14 days')
where first_eval_at is null
   or activation_expires_at is null;

create index if not exists idx_msgf_shadow_trials_first_eval_report
  on public.msgf_shadow_trials (expires_at)
  where first_eval_at is not null and report_sent_at is null;

create index if not exists idx_msgf_shadow_trials_unused_activation
  on public.msgf_shadow_trials (activation_expires_at)
  where first_eval_at is null;

create index if not exists idx_msgf_shadow_trials_full_access_expires
  on public.msgf_shadow_trials (full_access_expires_at)
  where full_access_started_at is not null;
