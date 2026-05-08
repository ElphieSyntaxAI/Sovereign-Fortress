-- Enforce consensus lifecycle + fast JSON scans on state_blob (lineage_label, lom_attempts, etc.).

alter table public.p4_state_ledger
  drop constraint if exists p4_state_ledger_consensus_status_check;

alter table public.p4_state_ledger
  add constraint p4_state_ledger_consensus_status_check
  check (consensus_status in ('pending', 'approved', 'rejected'));

create index if not exists p4_state_ledger_state_blob_gin
  on public.p4_state_ledger using gin (state_blob jsonb_path_ops);
