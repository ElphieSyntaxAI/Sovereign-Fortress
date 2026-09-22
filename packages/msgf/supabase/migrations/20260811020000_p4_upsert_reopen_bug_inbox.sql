-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
-- =============================================================================
-- Re-open dismissed bug-inbox rows when the same report is submitted again
-- (onscreen FAB / report-issue / self-heal).

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
  v_prev_status text;
begin
  select inbox_status into v_prev_status
    from public.p4_active_incidents
   where dedupe_hash = p_dedupe_hash;

  update public.p4_active_incidents
     set occurrence_count = public.p4_active_incidents.occurrence_count + 1,
         last_seen_at = now(),
         inbox_status = case
           when v_prev_status = 'dismissed' then 'open'
           else public.p4_active_incidents.inbox_status
         end,
         inbox_updated_at = case
           when v_prev_status = 'dismissed' then now()
           else public.p4_active_incidents.inbox_updated_at
         end
   where dedupe_hash = p_dedupe_hash
   returning id, occurrence_count into v_id, v_count;

  if found then
    return jsonb_build_object(
      'id', v_id,
      'occurrence_count', v_count,
      'deduplicated', true,
      'reopened', coalesce(v_prev_status = 'dismissed', false)
    );
  end if;

  insert into public.p4_active_incidents (
    dedupe_hash, tenant_id, error_message, location, severity,
    occurrence_count, first_seen_at, last_seen_at, inbox_status
  )
  values (
    p_dedupe_hash,
    p_tenant_id,
    p_error_message,
    coalesce(p_location, ''),
    coalesce(nullif(trim(p_severity), ''), 'Yellow'),
    1,
    now(),
    now(),
    'open'
  )
  returning id, occurrence_count into v_id, v_count;

  return jsonb_build_object(
    'id', v_id,
    'occurrence_count', v_count,
    'deduplicated', false,
    'reopened', false
  );
end;
$$;

revoke all on function public.p4_upsert_active_incident(text, text, text, text, text) from public;
revoke all on function public.p4_upsert_active_incident(text, text, text, text, text) from anon;
revoke all on function public.p4_upsert_active_incident(text, text, text, text, text) from authenticated;
grant execute on function public.p4_upsert_active_incident(text, text, text, text, text) to service_role;
