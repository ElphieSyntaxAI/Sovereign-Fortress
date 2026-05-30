-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
-- =============================================================================
-- Vault Seal §1.2: narrative body (`body_text`, `raw_content`) is not readable via direct SELECT for
-- `authenticated` / `service_role`; reads go through `vault_fetch_manuscript_body` (audited).
-- Rule 1: only `owner_id = auth.uid()` may receive body (without needing support_token).
-- Rule 2: other callers need non-empty JWT claim `support_token` (root or `user_metadata`) — including `service_role`.
-- Rule 3: each RPC call writes `security_audit_log` (ALLOWED or DENIED).
--
-- LIMITATIONS:
-- - RLS cannot hide columns; column REVOKE + RPC implements §1.2 for PostgREST-style access.
-- - Raw `SELECT` attempts are not logged (PostgreSQL has no SELECT trigger); use API logs, pgaudit, or RPC-only paths.
-- - `service_role` still bypasses RLS on the table; column REVOKE applies to that role when it uses the table role.

-- ---------------------------------------------------------------------------
-- security_audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role TEXT NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'p4_manuscripts',
  resource_id UUID,
  outcome TEXT NOT NULL CHECK (outcome IN ('ALLOWED', 'DENIED')),
  detail JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON public.security_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_resource ON public.security_audit_log (resource_type, resource_id);

COMMENT ON TABLE public.security_audit_log IS
  'Compliance log for vault RPC and related flows. Rows inserted by SECURITY DEFINER functions only.';

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_audit_log_service_all" ON public.security_audit_log;
CREATE POLICY "security_audit_log_service_all"
  ON public.security_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.security_audit_log TO service_role;
-- No GRANT to authenticated: inserts happen inside definer functions only.

-- ---------------------------------------------------------------------------
-- p4_manuscripts: owner_id + raw_content (canonical narrative body remains `body_text`)
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS raw_content TEXT;

COMMENT ON COLUMN public.p4_manuscripts.body_text IS
  'Vault "body" column in DB; direct SELECT revoked from authenticated / service_role — use RPC.';

COMMENT ON COLUMN public.p4_manuscripts.raw_content IS
  'Optional raw snapshot; same privilege posture as body_text.';

CREATE INDEX IF NOT EXISTS idx_p4_manuscripts_owner ON public.p4_manuscripts (owner_id);

COMMENT ON COLUMN public.p4_manuscripts.owner_id IS
  'Author (auth.users.id). Vault Seal §1.2: RPC allows body when owner_id = auth.uid() or support_token; backfill owner_id before production enforcement.';

-- ---------------------------------------------------------------------------
-- RPC: audited body fetch (only supported path to narrative columns for API roles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_fetch_manuscript_body(p_manuscript_id UUID)
RETURNS TABLE (body_text TEXT, raw_content TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := coalesce(auth.jwt() ->> 'role', 'authenticated');
  v_owner UUID;
  v_tenant UUID;
  v_body TEXT;
  v_raw TEXT;
  v_support TEXT;
  v_jwt_tenant TEXT;
  v_ok BOOLEAN := false;
BEGIN
  v_support := coalesce(
    auth.jwt() ->> 'support_token',
    auth.jwt() -> 'user_metadata' ->> 'support_token',
    ''
  );
  v_jwt_tenant := coalesce(
    auth.jwt() -> 'app_metadata' ->> 'tenant_id',
    auth.jwt() -> 'user_metadata' ->> 'tenant_id',
    ''
  );

  SELECT m.owner_id, m.tenant_id, m.body_text, m.raw_content
  INTO v_owner, v_tenant, v_body, v_raw
  FROM public.p4_manuscripts m
  WHERE m.id = p_manuscript_id;

  IF NOT FOUND THEN
    INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
    VALUES (v_role, auth.uid(), 'manuscript.body_fetch', p_manuscript_id, 'DENIED',
            jsonb_build_object('reason', 'not_found'));
    RETURN;
  END IF;

  IF v_role = 'service_role' THEN
    IF length(trim(v_support)) = 0 THEN
      INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
      VALUES (v_role, auth.uid(), 'manuscript.body_fetch', p_manuscript_id, 'DENIED',
              jsonb_build_object('reason', 'service_role_requires_support_token'));
      RETURN;
    END IF;
    IF v_jwt_tenant = '' OR v_tenant::text IS DISTINCT FROM v_jwt_tenant THEN
      INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
      VALUES (v_role, auth.uid(), 'manuscript.body_fetch', p_manuscript_id, 'DENIED',
              jsonb_build_object('reason', 'service_role_tenant_mismatch', 'manuscript_tenant', v_tenant));
      RETURN;
    END IF;
  ELSIF v_role = 'authenticated' THEN
    IF v_tenant::text IS DISTINCT FROM coalesce(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '') THEN
      INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
      VALUES (v_role, auth.uid(), 'manuscript.body_fetch', p_manuscript_id, 'DENIED',
              jsonb_build_object('reason', 'tenant_mismatch'));
      RETURN;
    END IF;
  ELSE
    INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
    VALUES (v_role, auth.uid(), 'manuscript.body_fetch', p_manuscript_id, 'DENIED',
            jsonb_build_object('reason', 'role_not_permitted'));
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND v_owner IS NOT NULL AND auth.uid() = v_owner THEN
    v_ok := true;
  ELSIF length(trim(v_support)) > 0 THEN
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
    VALUES (
      v_role,
      auth.uid(),
      'manuscript.body_fetch',
      p_manuscript_id,
      'DENIED',
      jsonb_build_object('reason', 'not_owner_and_no_support_token')
    );
    RETURN;
  END IF;

  INSERT INTO public.security_audit_log (actor_role, actor_user_id, action, resource_id, outcome, detail)
  VALUES (
    v_role,
    auth.uid(),
    'manuscript.body_fetch',
    p_manuscript_id,
    'ALLOWED',
    jsonb_build_object(
      'support_token_present', length(trim(v_support)) > 0,
      'as_owner', auth.uid() IS NOT NULL AND v_owner IS NOT NULL AND auth.uid() = v_owner
    )
  );

  body_text := v_body;
  raw_content := v_raw;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_fetch_manuscript_body(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_fetch_manuscript_body(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_fetch_manuscript_body(UUID) TO service_role;

COMMENT ON FUNCTION public.vault_fetch_manuscript_body IS
  'Vault Seal §1.2: returns body_text + raw_content when owner_id = auth.uid() or support_token set; logs security_audit_log.';

-- ---------------------------------------------------------------------------
-- Column privileges: block direct reads of narrative columns (Rule 1 + 2 for table access)
-- ---------------------------------------------------------------------------
REVOKE SELECT (body_text, raw_content) ON public.p4_manuscripts FROM PUBLIC;
REVOKE SELECT (body_text, raw_content) ON public.p4_manuscripts FROM anon;
REVOKE SELECT (body_text, raw_content) ON public.p4_manuscripts FROM authenticated;
REVOKE SELECT (body_text, raw_content) ON public.p4_manuscripts FROM service_role;

-- ---------------------------------------------------------------------------
-- RLS: tenant-wide row visibility (metadata columns still listable); narrative via RPC only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "p4_manuscripts_select_vault_seal_12" ON public.p4_manuscripts;
DROP POLICY IF EXISTS "p4_manuscripts_select_tenant" ON public.p4_manuscripts;

CREATE POLICY "p4_manuscripts_select_tenant"
  ON public.p4_manuscripts
  FOR SELECT
  TO authenticated
  USING (
    tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  );

COMMENT ON TABLE public.p4_manuscripts IS
  'Manuscripts: tenant RLS for rows; body_text/raw_content SELECT revoked — use vault_fetch_manuscript_body.';
