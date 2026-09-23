-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
-- =============================================================================
-- HAL offline sealed lease + accepted batch replay protection.
-- Verified offline_sealed sessions are full-value authorship (same rolling-5 as live).
-- Integrity is seal + tamper suite; rejected attempts never insert into p4_hal_ledger.

ALTER TABLE public.p4_hal_ledger
  ADD COLUMN IF NOT EXISTS sync_mode TEXT;

COMMENT ON COLUMN public.p4_hal_ledger.sync_mode IS
'Connectivity mode: live | offline_sealed (null = legacy live). Equal score weight when accepted.';

CREATE INDEX IF NOT EXISTS idx_p4_hal_ledger_tenant_sync_mode
  ON public.p4_hal_ledger (tenant_id, sync_mode, created_at DESC);

CREATE TABLE IF NOT EXISTS public.p4_hal_offline_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id TEXT NOT NULL,
  author_user_id UUID,
  extension_instance_id TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_p4_hal_offline_leases_tenant_ms
  ON public.p4_hal_offline_leases (tenant_id, manuscript_id, expires_at DESC);

COMMENT ON TABLE public.p4_hal_offline_leases IS
'Short-lived HMAC leases for focus/offline HAL sealing (product-grade integrity).';

ALTER TABLE public.p4_hal_offline_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hal_offline_leases_select_tenant" ON public.p4_hal_offline_leases;
CREATE POLICY "hal_offline_leases_select_tenant"
ON public.p4_hal_offline_leases
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

CREATE TABLE IF NOT EXISTS public.p4_hal_offline_accepted_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id TEXT NOT NULL,
  lease_id UUID NOT NULL REFERENCES public.p4_hal_offline_leases (id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL,
  batch_hash TEXT NOT NULL,
  hal_ledger_id UUID REFERENCES public.p4_hal_ledger (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, manuscript_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_p4_hal_offline_accepted_batches_lease
  ON public.p4_hal_offline_accepted_batches (lease_id, created_at DESC);

COMMENT ON TABLE public.p4_hal_offline_accepted_batches IS
'Replay protection for sealed offline HAL batches.';

ALTER TABLE public.p4_hal_offline_accepted_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hal_offline_batches_select_tenant" ON public.p4_hal_offline_accepted_batches;
CREATE POLICY "hal_offline_batches_select_tenant"
ON public.p4_hal_offline_accepted_batches
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

-- Rolling-5 already includes all ledger rows (rejected never insert).
DO $hal_offline_view_comment$
BEGIN
  COMMENT ON VIEW public.p4_hal_ledger_rolling_avg_5 IS
  'Last 5 post-recalibration HAL sessions per tenant. Includes live and verified offline_sealed rows (equal weight).';
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- view not present yet on fresh partial applies
END
$hal_offline_view_comment$;
