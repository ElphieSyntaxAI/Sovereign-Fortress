-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
-- =============================================================================
-- Rolling 5-session linguistic baseline per tenant (for HAL drift / match factor).
-- Expects stylometric_snapshot.linguistic_profile.* populated by author-ecosystem HAL ingest.
-- Bootstrap definition (last five rows, no recalibration window). After
-- 20260510160000_recalibration_biometric_adjustments.sql runs, this view is replaced in-place
-- by CREATE OR REPLACE with recalibration_event boundary filtering on the same object name.

CREATE OR REPLACE VIEW public.p4_hal_ledger_rolling_avg_5 AS
WITH ranked AS (
  SELECT
    tenant_id,
    stylometric_snapshot,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY created_at DESC
    ) AS rn
  FROM public.p4_hal_ledger
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
'Mean linguistic_profile metrics over the last five p4_hal_ledger rows per tenant_id.';

GRANT SELECT ON public.p4_hal_ledger_rolling_avg_5 TO service_role;
