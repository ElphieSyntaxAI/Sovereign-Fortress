-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
-- =============================================================================
-- DEV_TEST cold layer: mirrors pillar_vectors so sandbox writes never pollute production Hall/Vault.

CREATE TABLE IF NOT EXISTS public.msgf_sandbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.msgf_sandbox IS
  'Tenant DEV_TEST Vault/Hall cold layer. Same shape as pillar_vectors; isolated from production records.';

CREATE INDEX IF NOT EXISTS msgf_sandbox_metadata_gin
  ON public.msgf_sandbox USING gin (metadata jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_msgf_sandbox_metadata_tenant
  ON public.msgf_sandbox ((metadata->> 'tenant_id'))
  WHERE metadata ? 'tenant_id';

ALTER TABLE public.msgf_sandbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_sandbox_service_role_all" ON public.msgf_sandbox;
CREATE POLICY "msgf_sandbox_service_role_all"
  ON public.msgf_sandbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "msgf_sandbox_tenant_select" ON public.msgf_sandbox;
CREATE POLICY "msgf_sandbox_tenant_select"
  ON public.msgf_sandbox
  FOR SELECT
  TO authenticated
  USING (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "msgf_sandbox_tenant_insert" ON public.msgf_sandbox;
CREATE POLICY "msgf_sandbox_tenant_insert"
  ON public.msgf_sandbox
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "msgf_sandbox_tenant_update" ON public.msgf_sandbox;
CREATE POLICY "msgf_sandbox_tenant_update"
  ON public.msgf_sandbox
  FOR UPDATE
  TO authenticated
  USING (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  )
  WITH CHECK (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

DROP POLICY IF EXISTS "msgf_sandbox_tenant_delete" ON public.msgf_sandbox;
CREATE POLICY "msgf_sandbox_tenant_delete"
  ON public.msgf_sandbox
  FOR DELETE
  TO authenticated
  USING (
    public.msgf_tenant_row_allowed(metadata->> 'tenant_id')
  );

REVOKE ALL ON public.msgf_sandbox FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msgf_sandbox TO authenticated;
GRANT ALL ON public.msgf_sandbox TO service_role;
