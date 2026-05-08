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

create policy "p4_state_ledger_select_own"
  on public.p4_state_ledger
  for select
  to authenticated
  using (auth.uid() = author_id);
