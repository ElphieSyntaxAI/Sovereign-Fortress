-- Demo table for MSGF /todos SSR example. Tighten RLS before production.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "todos_select_anon_authenticated"
  on public.todos
  for select
  to anon, authenticated
  using (true);
