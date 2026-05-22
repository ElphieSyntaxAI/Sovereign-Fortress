-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
-- =============================================================================
-- Recalibration: HAL + forensic metadata, biometric adjustment log, rolling view reset after last recal event.

-- ---------------------------------------------------------------------------
-- p4_hal_ledger
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_hal_ledger
  ADD COLUMN IF NOT EXISTS recalibration_event BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recalibration_reason TEXT;

COMMENT ON COLUMN public.p4_hal_ledger.recalibration_event IS
'When true, sessions older than this row''s created_at are excluded from rolling linguistic baseline.';
COMMENT ON COLUMN public.p4_hal_ledger.recalibration_reason IS
'Free-text or app-defined reason; structured reasons also logged in p4_biometric_adjustments.';

-- ---------------------------------------------------------------------------
-- p4_forensic_profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_forensic_profiles
  ADD COLUMN IF NOT EXISTS recalibration_event BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recalibration_reason TEXT;

COMMENT ON COLUMN public.p4_forensic_profiles.recalibration_event IS
'Marks a forensic profile row tied to a typing recalibration.';
COMMENT ON COLUMN public.p4_forensic_profiles.recalibration_reason IS
'Optional note; pair with p4_biometric_adjustments for structured reason codes.';

-- ---------------------------------------------------------------------------
-- p4_biometric_adjustments (structured reasons)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_biometric_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('injury', 'physical_change', 'time_gap', 'other')
  ),
  notes TEXT,
  hal_ledger_id UUID REFERENCES public.p4_hal_ledger (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_biometric_adjustments_tenant_time
  ON public.p4_biometric_adjustments (tenant_id, created_at DESC);

COMMENT ON TABLE public.p4_biometric_adjustments IS
'Why a user recalibrated: injury, physical_change (e.g. nails/keyboard), time_gap, or other.';

ALTER TABLE public.p4_biometric_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "biometric_select_tenant" ON public.p4_biometric_adjustments;
CREATE POLICY "biometric_select_tenant"
ON public.p4_biometric_adjustments
FOR SELECT
TO authenticated
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

DROP POLICY IF EXISTS "biometric_insert_tenant" ON public.p4_biometric_adjustments;
CREATE POLICY "biometric_insert_tenant"
ON public.p4_biometric_adjustments
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

-- ---------------------------------------------------------------------------
-- Rolling avg view: canonical name public.p4_hal_ledger_rolling_avg_5
-- (same name as 20260510150000; definition here replaces bootstrap with recalibration-aware logic.)
-- Drop legacy mistaken v_ name from older revision of this migration.
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
'Mean linguistic_profile over up to 5 HAL sessions per tenant after the latest recalibration_event (fresh window).';

GRANT SELECT ON public.p4_hal_ledger_rolling_avg_5 TO service_role;
