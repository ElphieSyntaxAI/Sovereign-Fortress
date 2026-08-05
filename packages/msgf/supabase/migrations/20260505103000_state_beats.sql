-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
-- =============================================================================
-- P4 State Ledger: author "beats" for keystroke-flow verification.
-- If you use Cognito or another IdP, adjust RLS policies to match how you store author_id.

create table if not exists public.state_beats (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  beat_text text not null,
  sequence_index integer not null default 0,
  label text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists state_beats_author_sequence_idx
  on public.state_beats (author_id, sequence_index);

alter table public.state_beats enable row level security;

drop policy if exists "state_beats_select_own" on public.state_beats;
create policy "state_beats_select_own"
  on public.state_beats for select
  to authenticated
  using (author_id = (select auth.uid()::text));

drop policy if exists "state_beats_insert_own" on public.state_beats;
create policy "state_beats_insert_own"
  on public.state_beats for insert
  to authenticated
  with check (author_id = (select auth.uid()::text));

drop policy if exists "state_beats_update_own" on public.state_beats;
create policy "state_beats_update_own"
  on public.state_beats for update
  to authenticated
  using (author_id = (select auth.uid()::text))
  with check (author_id = (select auth.uid()::text));

drop policy if exists "state_beats_delete_own" on public.state_beats;
create policy "state_beats_delete_own"
  on public.state_beats for delete
  to authenticated
  using (author_id = (select auth.uid()::text));
