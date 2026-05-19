-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
-- =============================================================================
-- Tenant sovereign RLS for MSGF cold layer + incidents + profiles.
-- Access requires auth.uid() ownership and/or a tenant_id that matches the active silo
-- (JWT user_metadata.tenant_id and/or contract license / tenant API key via Authorization: Bearer).
--
-- service_role bypasses RLS (PulseEngine admin client). authenticated is silo-scoped.
-- anon has no policies (deny by default once RLS is enabled).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Optional per-tenant API keys (mint hashes offline; plain keys never stored).
CREATE TABLE IF NOT EXISTS public.msgf_tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msgf_tenant_api_keys_hash_unique UNIQUE (api_key_hash),
  CONSTRAINT msgf_tenant_api_keys_hash_format CHECK (
    char_length(api_key_hash) = 64
    AND api_key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT msgf_tenant_api_keys_status_check CHECK (
    status IN ('active', 'revoked')
  )
);

CREATE INDEX IF NOT EXISTS idx_msgf_tenant_api_keys_tenant_status
  ON public.msgf_tenant_api_keys (tenant_id, status);

COMMENT ON TABLE public.msgf_tenant_api_keys IS
  'Per-tenant API key hashes for IDE/CLI direct Supabase access. Mint offline; store SHA-256 hex only.';

ALTER TABLE public.msgf_tenant_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_tenant_api_keys_service_role_all" ON public.msgf_tenant_api_keys;
CREATE POLICY "msgf_tenant_api_keys_service_role_all"
  ON public.msgf_tenant_api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_tenant_api_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_tenant_api_keys TO service_role;

-- ---------------------------------------------------------------------------
-- Request context helpers (JWT + Bearer license / tenant API key + header guard)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.msgf_request_header(header_name text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(
      both '"'
      FROM COALESCE(
        current_setting('request.headers', true)::json ->> lower(header_name),
        current_setting('request.headers', true)::json ->> header_name
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.msgf_request_header(text) IS
  'Reads a PostgREST request header (lowercase keys in JSON).';

CREATE OR REPLACE FUNCTION public.msgf_bearer_token()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        COALESCE(
          public.msgf_request_header('authorization'),
          ''
        ),
        '^[Bb]earer\s+',
        ''
      )
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.msgf_sha256_hex(p_plain text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(p_plain, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.msgf_license_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.tenant_id
  FROM public.msgf_licenses l
  WHERE l.status = 'active'
    AND public.msgf_bearer_token() IS NOT NULL
    AND public.msgf_bearer_token() LIKE 'msgf_live_%'
    AND l.license_key_hash = public.msgf_sha256_hex(public.msgf_bearer_token())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.msgf_tenant_api_key_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.tenant_id
  FROM public.msgf_tenant_api_keys k
  WHERE k.status = 'active'
    AND public.msgf_bearer_token() IS NOT NULL
    AND k.api_key_hash = public.msgf_sha256_hex(public.msgf_bearer_token())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.msgf_jwt_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(trim(auth.jwt() -> 'user_metadata' ->> 'tenant_id'), '');
$$;

CREATE OR REPLACE FUNCTION public.msgf_header_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(trim(public.msgf_request_header('x-msgf-tenant-id')), '');
$$;

CREATE OR REPLACE FUNCTION public.msgf_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'role') = 'service_role'
    OR current_user = 'service_role',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.msgf_effective_tenant_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_tid text;
  license_tid text;
  api_tid text;
  header_tid text;
  resolved text;
BEGIN
  IF public.msgf_is_service_role() THEN
    RETURN public.msgf_header_tenant_id();
  END IF;

  jwt_tid := public.msgf_jwt_tenant_id();
  license_tid := public.msgf_license_tenant_id();
  api_tid := public.msgf_tenant_api_key_tenant_id();
  header_tid := public.msgf_header_tenant_id();

  resolved := COALESCE(jwt_tid, license_tid, api_tid);

  IF resolved IS NULL THEN
    RETURN NULL;
  END IF;

  IF header_tid IS NOT NULL AND header_tid <> resolved THEN
    RETURN NULL;
  END IF;

  RETURN resolved;
END;
$$;

COMMENT ON FUNCTION public.msgf_effective_tenant_id() IS
  'Tenant silo from JWT user_metadata, Bearer license/API key, or service_role header. x-msgf-tenant-id must match when set.';

CREATE OR REPLACE FUNCTION public.msgf_tenant_row_allowed(p_row_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.msgf_is_service_role()
    OR (
      p_row_tenant_id IS NOT NULL
      AND btrim(p_row_tenant_id) <> ''
      AND p_row_tenant_id = public.msgf_effective_tenant_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.msgf_profile_row_allowed(
  p_user_id uuid,
  p_profile_tenant_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.msgf_is_service_role()
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid() = p_user_id
      AND (
        p_profile_tenant_id IS NULL
        OR btrim(p_profile_tenant_id) = ''
        OR p_profile_tenant_id = public.msgf_effective_tenant_id()
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- pillar_vectors (tenant in metadata.tenant_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_metadata_tenant
  ON public.pillar_vectors ((metadata->> 'tenant_id'))
  WHERE metadata ? 'tenant_id';

ALTER TABLE public.pillar_vectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pillar_vectors_service_role_all" ON public.pillar_vectors;
CREATE POLICY "pillar_vectors_service_role_all"
  ON public.pillar_vectors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "pillar_vectors_tenant_select" ON public.pillar_vectors;
CREATE POLICY "pillar_vectors_tenant_select"
  ON public.pillar_vectors
  FOR SELECT
  TO authenticated
  USING (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "pillar_vectors_tenant_insert" ON public.pillar_vectors;
CREATE POLICY "pillar_vectors_tenant_insert"
  ON public.pillar_vectors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "pillar_vectors_tenant_update" ON public.pillar_vectors;
CREATE POLICY "pillar_vectors_tenant_update"
  ON public.pillar_vectors
  FOR UPDATE
  TO authenticated
  USING (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  )
  WITH CHECK (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "pillar_vectors_tenant_delete" ON public.pillar_vectors;
CREATE POLICY "pillar_vectors_tenant_delete"
  ON public.pillar_vectors
  FOR DELETE
  TO authenticated
  USING (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

REVOKE ALL ON public.pillar_vectors FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pillar_vectors TO authenticated;
GRANT ALL ON public.pillar_vectors TO service_role;

-- ---------------------------------------------------------------------------
-- msgf_incidents (tenant in metadata.tenant_id; owner in user_id)
-- ---------------------------------------------------------------------------

ALTER TABLE public.msgf_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_incidents_service_role_all" ON public.msgf_incidents;
CREATE POLICY "msgf_incidents_service_role_all"
  ON public.msgf_incidents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "msgf_incidents_tenant_owner_select" ON public.msgf_incidents;
CREATE POLICY "msgf_incidents_tenant_owner_select"
  ON public.msgf_incidents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "msgf_incidents_tenant_owner_insert" ON public.msgf_incidents;
CREATE POLICY "msgf_incidents_tenant_owner_insert"
  ON public.msgf_incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "msgf_incidents_tenant_owner_update" ON public.msgf_incidents;
CREATE POLICY "msgf_incidents_tenant_owner_update"
  ON public.msgf_incidents
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "msgf_incidents_tenant_owner_delete" ON public.msgf_incidents;
CREATE POLICY "msgf_incidents_tenant_owner_delete"
  ON public.msgf_incidents
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

REVOKE ALL ON public.msgf_incidents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msgf_incidents TO authenticated;
GRANT ALL ON public.msgf_incidents TO service_role;

-- ---------------------------------------------------------------------------
-- p4_profiles (owner_id = user_id; optional tenant_id silo tag)
-- ---------------------------------------------------------------------------

ALTER TABLE public.p4_profiles
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_p4_profiles_tenant_id
  ON public.p4_profiles (tenant_id)
  WHERE tenant_id IS NOT NULL;

COMMENT ON COLUMN public.p4_profiles.tenant_id IS
  'MSGF project silo (e.g. author_ecosystem). When set, RLS requires match with msgf_effective_tenant_id().';

ALTER TABLE public.p4_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_profiles_select_own" ON public.p4_profiles;
DROP POLICY IF EXISTS "p4_profiles_update_own" ON public.p4_profiles;

DROP POLICY IF EXISTS "p4_profiles_service_role_all" ON public.p4_profiles;
CREATE POLICY "p4_profiles_service_role_all"
  ON public.p4_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "p4_profiles_tenant_owner_select" ON public.p4_profiles;
CREATE POLICY "p4_profiles_tenant_owner_select"
  ON public.p4_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.msgf_profile_row_allowed(user_id, tenant_id)
  );

DROP POLICY IF EXISTS "p4_profiles_tenant_owner_update" ON public.p4_profiles;
CREATE POLICY "p4_profiles_tenant_owner_update"
  ON public.p4_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.msgf_profile_row_allowed(user_id, tenant_id)
  )
  WITH CHECK (
    public.msgf_profile_row_allowed(user_id, tenant_id)
    AND (
      tenant_id IS NULL
      OR btrim(tenant_id) = ''
      OR tenant_id = public.msgf_effective_tenant_id()
    )
  );

DROP POLICY IF EXISTS "p4_profiles_tenant_owner_insert" ON public.p4_profiles;
CREATE POLICY "p4_profiles_tenant_owner_insert"
  ON public.p4_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      tenant_id IS NULL
      OR tenant_id = public.msgf_effective_tenant_id()
    )
  );

REVOKE ALL ON public.p4_profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.p4_profiles TO authenticated;
GRANT ALL ON public.p4_profiles TO service_role;

GRANT EXECUTE ON FUNCTION public.msgf_request_header(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_bearer_token() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_sha256_hex(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_license_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_tenant_api_key_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_jwt_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_header_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_is_service_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_effective_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_tenant_row_allowed(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.msgf_profile_row_allowed(uuid, text) TO authenticated, service_role;
