-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
-- =============================================================================
-- Demo table for MSGF /todos SSR example. Tighten RLS before production.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

drop policy if exists "todos_select_anon_authenticated" on public.todos;

create policy "todos_select_anon_authenticated"
  on public.todos
  for select
  to anon, authenticated
  using (true);
