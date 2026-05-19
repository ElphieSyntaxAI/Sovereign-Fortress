-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
-- =============================================================================
-- HAL recalibration: ledger flags, audit log, rolling average view reset after last recalibration.

-- ---------------------------------------------------------------------------
-- p4_hal_ledger (idempotent if columns already exist)
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_hal_ledger
  ADD COLUMN IF NOT EXISTS recalibration_event BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recalibration_reason TEXT;

COMMENT ON COLUMN public.p4_hal_ledger.recalibration_event IS
'When true, marks a baseline reset; rolling averages ignore earlier sessions for this tenant.';
COMMENT ON COLUMN public.p4_hal_ledger.recalibration_reason IS
'Human-readable reason; detailed audit in p4_recalibration_logs.';

-- ---------------------------------------------------------------------------
-- p4_recalibration_logs (audit trail for resets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_recalibration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  hal_ledger_id UUID REFERENCES public.p4_hal_ledger (id) ON DELETE SET NULL,
  recalibration_reason TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_recalibration_logs_tenant_time
  ON public.p4_recalibration_logs (tenant_id, created_at DESC);

COMMENT ON TABLE public.p4_recalibration_logs IS
'Audit history of HAL baseline resets (recalibration) per tenant.';

ALTER TABLE public.p4_recalibration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recal_logs_select_tenant" ON public.p4_recalibration_logs;
CREATE POLICY "recal_logs_select_tenant"
ON public.p4_recalibration_logs
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

DROP POLICY IF EXISTS "recal_logs_insert_tenant" ON public.p4_recalibration_logs;
CREATE POLICY "recal_logs_insert_tenant"
ON public.p4_recalibration_logs
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

-- ---------------------------------------------------------------------------
-- Rolling average: canonical name p4_hal_ledger_rolling_avg_5
-- (Definition must match 20260510160000_recalibration_biometric_adjustments.sql — keep in sync.)
-- Only sessions on or after the latest recalibration_event = true (per tenant);
-- then the 5 most recent of those rows (cleans the slate for the moving average).
-- Idempotent: repairs DBs that ran an older 10160000 that created v_p4_hal_ledger_rolling_avg_5 only.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_p4_hal_ledger_rolling_avg_5;

CREATE OR REPLACE VIEW public.p4_hal_ledger_rolling_avg_5 AS
WITH tenant_recal_boundary AS (
  SELECT
    tenant_id,
    MAX(created_at) AS boundary_at
  FROM public.p4_hal_ledger
  WHERE recalibration_event = TRUE
  GROUP BY tenant_id
),
post_recal_sessions AS (
  SELECT
    h.tenant_id,
    h.stylometric_snapshot,
    h.created_at
  FROM public.p4_hal_ledger h
  LEFT JOIN tenant_recal_boundary b ON b.tenant_id = h.tenant_id
  WHERE b.boundary_at IS NULL
     OR h.created_at >= b.boundary_at
),
ranked AS (
  SELECT
    tenant_id,
    stylometric_snapshot,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY created_at DESC
    ) AS rn
  FROM post_recal_sessions
),
last5 AS (
  SELECT *
  FROM ranked
  WHERE rn <= 5
)
SELECT
  tenant_id,
  COUNT(*)::INT AS sample_sessions,
  AVG(
    NULLIF((stylometric_snapshot -> 'linguistic_profile' ->> 'ttr')::DOUBLE PRECISION, NULL)
  ) AS avg_ttr,
  AVG(
    NULLIF(
      (stylometric_snapshot -> 'linguistic_profile' ->> 'avg_sentence_length_words')::DOUBLE PRECISION,
      NULL
    )
  ) AS avg_avg_sentence_length_words,
  AVG(
    NULLIF(
      (stylometric_snapshot -> 'linguistic_profile' ->> 'punctuation_frequency')::DOUBLE PRECISION,
      NULL
    )
  ) AS avg_punctuation_frequency,
  AVG(
    NULLIF(
      (stylometric_snapshot -> 'linguistic_profile' ->> 'function_word_weight')::DOUBLE PRECISION,
      NULL
    )
  ) AS avg_function_word_weight,
  AVG(
    NULLIF(
      (stylometric_snapshot -> 'linguistic_profile' ->> 'sentence_length_std_dev')::DOUBLE PRECISION,
      NULL
    )
  ) AS avg_sentence_length_std_dev
FROM last5
GROUP BY tenant_id;

COMMENT ON VIEW public.p4_hal_ledger_rolling_avg_5 IS
'Up to 5 most recent HAL sessions per tenant after the latest recalibration_event = true (fresh moving average).';

GRANT SELECT ON public.p4_hal_ledger_rolling_avg_5 TO service_role;
