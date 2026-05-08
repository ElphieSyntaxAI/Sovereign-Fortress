-- P4 State Ledger legal defensibility:
-- Track which Terms & Conditions version the user agreed to at Pulse time.

alter table public.state_beats
add column if not exists legal_version text not null default 'unknown';

-- Optional: keep the default for safety; audits prefer explicit writes.
