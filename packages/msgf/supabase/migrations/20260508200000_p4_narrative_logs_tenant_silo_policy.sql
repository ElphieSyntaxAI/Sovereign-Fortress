-- Tenant silo: JWT user_metadata.tenant_id must match row tenant_id for SELECT.
ALTER TABLE public.p4_narrative_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see their own tenant logs" ON public.p4_narrative_logs;

CREATE POLICY "Users can only see their own tenant logs"
ON public.p4_narrative_logs
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);
