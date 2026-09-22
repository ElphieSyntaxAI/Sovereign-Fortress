-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
-- =============================================================================
-- Align p4_narrative_logs.tenant_id from TEXT to UUID.
-- Non-UUID labels (e.g. system-test, unknown-tenant) are mapped to a sentinel UUID before cast.
-- Sentinel: 00000000-0000-4000-8000-000000000001 (see src/lib/tenant-ids.ts)
--
-- RLS: JWT user_metadata.tenant_id must be a valid UUID string for SELECT to match rows.

DO $migrate$
BEGIN
  IF to_regclass('public.p4_narrative_logs') IS NULL THEN
    RAISE NOTICE 'p4_narrative_logs missing; skip tenant_id UUID alignment';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'p4_narrative_logs'
      AND column_name = 'tenant_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE NOTICE 'p4_narrative_logs.tenant_id already UUID; skip';
    RETURN;
  END IF;

  UPDATE public.p4_narrative_logs
  SET tenant_id = '00000000-0000-4000-8000-000000000001'
  WHERE tenant_id IS NOT NULL
    AND tenant_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  DROP POLICY IF EXISTS "Users can only see their own tenant logs" ON public.p4_narrative_logs;

  ALTER TABLE public.p4_narrative_logs
    ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

  drop policy if exists "Users can only see their own tenant logs" on public.p4_narrative_logs;
create policy "Users can only see their own tenant logs"
  on public.p4_narrative_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
  );

  COMMENT ON COLUMN public.p4_narrative_logs.tenant_id IS
    'Author/workspace tenant UUID; JWT user_metadata.tenant_id must be the same UUID string for RLS.';
END
$migrate$;
