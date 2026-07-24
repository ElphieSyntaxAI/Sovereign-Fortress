-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
-- =============================================================================
-- Lock down backend-only tables: incident ledger + legacy auth rows (password_hash).
-- App access: service_role (BFF / Next admin) and SECURITY DEFINER RPCs only.

-- ---------------------------------------------------------------------------
-- public.p4_active_incidents
-- ---------------------------------------------------------------------------

ALTER TABLE public.p4_active_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_active_incidents_service_role_all" ON public.p4_active_incidents;

CREATE POLICY "p4_active_incidents_service_role_all"
  ON public.p4_active_incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.p4_active_incidents FROM PUBLIC;
REVOKE ALL ON public.p4_active_incidents FROM anon;
REVOKE ALL ON public.p4_active_incidents FROM authenticated;

GRANT ALL ON public.p4_active_incidents TO service_role;

-- Writes go through p4_upsert_active_incident (SECURITY DEFINER); keep RPC service-only.
REVOKE ALL ON FUNCTION public.p4_upsert_active_incident(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.p4_upsert_active_incident(text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.p4_upsert_active_incident(text, text, text, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.p4_upsert_active_incident(text, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- public.msgf_legacy_users (password_hash — never expose via publishable key)
-- ---------------------------------------------------------------------------

ALTER TABLE public.msgf_legacy_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_legacy_users_service_role_all" ON public.msgf_legacy_users;

CREATE POLICY "msgf_legacy_users_service_role_all"
  ON public.msgf_legacy_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_legacy_users FROM PUBLIC;
REVOKE ALL ON public.msgf_legacy_users FROM anon;
REVOKE ALL ON public.msgf_legacy_users FROM authenticated;

GRANT ALL ON public.msgf_legacy_users TO service_role;

COMMENT ON TABLE public.p4_active_incidents IS
  'MSGF incident ledger (Yellow by default); RLS service_role only — use p4_upsert_active_incident.';

COMMENT ON TABLE public.msgf_legacy_users IS
  'Legacy author rows (password_hash). RLS service_role only — prefer public.p4_profiles for client reads.';
