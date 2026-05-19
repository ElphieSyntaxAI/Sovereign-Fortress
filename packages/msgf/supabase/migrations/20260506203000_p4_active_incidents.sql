-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
-- =============================================================================
-- P4 active incidents: deduplicated bug / feedback reports from tenant surfaces (MSGF bridge).

create table if not exists public.p4_active_incidents (
  id uuid primary key default gen_random_uuid(),
  dedupe_hash text not null,
  tenant_id text not null,
  error_message text not null,
  location text not null default '',
  severity text not null default 'Yellow',
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint p4_active_incidents_dedupe_hash_key unique (dedupe_hash)
);

create index if not exists p4_active_incidents_tenant_id_idx
  on public.p4_active_incidents (tenant_id);

create index if not exists p4_active_incidents_last_seen_idx
  on public.p4_active_incidents (last_seen_at desc);

comment on table public.p4_active_incidents is 'MSGF incident ledger (Yellow by default); dedupe_hash = sha256(message||location).';

-- Atomic insert-or-increment (avoids race on duplicate reports).
create or replace function public.p4_upsert_active_incident(
  p_dedupe_hash text,
  p_tenant_id text,
  p_error_message text,
  p_location text,
  p_severity text default 'Yellow'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer;
begin
  update public.p4_active_incidents
     set occurrence_count = public.p4_active_incidents.occurrence_count + 1,
         last_seen_at = now()
   where dedupe_hash = p_dedupe_hash
   returning id, occurrence_count into v_id, v_count;

  if found then
    return jsonb_build_object(
      'id', v_id,
      'occurrence_count', v_count,
      'deduplicated', true
    );
  end if;

  insert into public.p4_active_incidents (
    dedupe_hash, tenant_id, error_message, location, severity, occurrence_count, first_seen_at, last_seen_at
  )
  values (
    p_dedupe_hash,
    p_tenant_id,
    p_error_message,
    coalesce(p_location, ''),
    coalesce(nullif(trim(p_severity), ''), 'Yellow'),
    1,
    now(),
    now()
  )
  returning id, occurrence_count into v_id, v_count;

  return jsonb_build_object(
    'id', v_id,
    'occurrence_count', v_count,
    'deduplicated', false
  );
end;
$$;

grant execute on function public.p4_upsert_active_incident(text, text, text, text, text) to service_role;
