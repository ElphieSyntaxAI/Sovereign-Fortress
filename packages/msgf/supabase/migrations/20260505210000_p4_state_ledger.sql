-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
-- =============================================================================
-- P4 state ledger for LOM / consensus outcomes (service-role writes from API).

create table if not exists public.p4_state_ledger (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  gate text,
  consensus_status text not null,
  state_blob jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists p4_state_ledger_author_created_idx
  on public.p4_state_ledger (author_id, created_at desc);

alter table public.p4_state_ledger enable row level security;

drop policy if exists "p4_state_ledger_select_own" on public.p4_state_ledger;
create policy "p4_state_ledger_select_own"
  on public.p4_state_ledger
  for select
  to authenticated
  using (auth.uid() = author_id);
