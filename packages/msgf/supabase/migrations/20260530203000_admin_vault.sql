-- Operator-only forensic store (service_role). Tenant/authenticated JWTs must never read this table.

CREATE TABLE IF NOT EXISTS public.admin_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pulse_forensic',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_vault_tenant_created
  ON public.admin_vault (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_vault_kind_created
  ON public.admin_vault (kind, created_at DESC);

COMMENT ON TABLE public.admin_vault IS
  'Full Pulse / internal forensic payloads. RLS: service_role only — never exposed on tenant-scoped APIs.';

ALTER TABLE public.admin_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_vault_service_role_all" ON public.admin_vault;
CREATE POLICY "admin_vault_service_role_all"
  ON public.admin_vault
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.admin_vault FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_vault TO service_role;
