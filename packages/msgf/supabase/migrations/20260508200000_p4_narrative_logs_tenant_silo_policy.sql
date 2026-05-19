-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
-- =============================================================================
-- Tenant silo: JWT user_metadata.tenant_id must match row tenant_id for SELECT.
ALTER TABLE public.p4_narrative_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see their own tenant logs" ON public.p4_narrative_logs;

CREATE POLICY "Users can only see their own tenant logs"
ON public.p4_narrative_logs
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);
