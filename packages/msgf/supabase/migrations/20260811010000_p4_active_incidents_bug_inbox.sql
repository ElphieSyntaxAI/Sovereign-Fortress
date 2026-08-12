-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
-- =============================================================================
-- Bug inbox: operator triage for p4_active_incidents (Sentinel / report-issue).

alter table public.p4_active_incidents
  add column if not exists inbox_status text not null default 'open'
    check (inbox_status in ('open', 'promoted', 'dismissed'));

alter table public.p4_active_incidents
  add column if not exists promoted_msgf_incident_id uuid;

alter table public.p4_active_incidents
  add column if not exists inbox_note text;

alter table public.p4_active_incidents
  add column if not exists inbox_updated_at timestamptz;

create index if not exists p4_active_incidents_inbox_status_idx
  on public.p4_active_incidents (inbox_status, last_seen_at desc);

comment on column public.p4_active_incidents.inbox_status is
  'Operator bug inbox: open (default) | promoted to msgf_incidents | dismissed.';
comment on column public.p4_active_incidents.promoted_msgf_incident_id is
  'msgf_incidents.id when inbox_status=promoted.';
