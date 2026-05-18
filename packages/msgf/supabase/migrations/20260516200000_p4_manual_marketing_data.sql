-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
-- =============================================================================
-- Phase 2 bridge: manual KDP / social metrics (author-entered) for correlation with HAL writing effort.

CREATE TABLE IF NOT EXISTS public.p4_manual_marketing_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  /** Calendar day the author checked storefront / analytics (e.g. morning KDP coffee run). */
  recorded_date DATE NOT NULL,
  platform TEXT NOT NULL,
  interaction_count INT NOT NULL DEFAULT 0 CHECK (interaction_count >= 0),
  comment_count INT NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  sales_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (sales_revenue >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_manual_marketing_tenant_manuscript_date
  ON public.p4_manual_marketing_data (tenant_id, manuscript_id, recorded_date DESC);

CREATE INDEX IF NOT EXISTS idx_p4_manual_marketing_recorded_date
  ON public.p4_manual_marketing_data (recorded_date DESC);

COMMENT ON TABLE public.p4_manual_marketing_data IS
  'Manual marketing / storefront snapshots (Phase 2) for correlation with p4_hal_ledger writing effort.';

ALTER TABLE public.p4_manual_marketing_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_manual_marketing_select_tenant" ON public.p4_manual_marketing_data;
CREATE POLICY "p4_manual_marketing_select_tenant"
ON public.p4_manual_marketing_data
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_manual_marketing_insert_tenant" ON public.p4_manual_marketing_data;
CREATE POLICY "p4_manual_marketing_insert_tenant"
ON public.p4_manual_marketing_data
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_manual_marketing_update_tenant" ON public.p4_manual_marketing_data;
CREATE POLICY "p4_manual_marketing_update_tenant"
ON public.p4_manual_marketing_data
FOR UPDATE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
)
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_manual_marketing_delete_tenant" ON public.p4_manual_marketing_data;
CREATE POLICY "p4_manual_marketing_delete_tenant"
ON public.p4_manual_marketing_data
FOR DELETE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

-- Correlation: daily HAL aggregates (writing effort) LEFT JOIN manual marketing rows (same calendar date).
-- Skipped when p4_hal_ledger is not deployed yet (forensic stack).
DO $$
BEGIN
  IF to_regclass('public.p4_hal_ledger') IS NULL THEN
    RAISE NOTICE 'p4_hal_ledger missing — skip view p4_v_marketing_hal_correlation';
    RETURN;
  END IF;

  EXECUTE $v$
CREATE OR REPLACE VIEW public.p4_v_marketing_hal_correlation AS
WITH hal_daily AS (
  SELECT
    h.tenant_id,
    (h.raw_sample->>'manuscriptId')::uuid AS manuscript_id,
    ((h.created_at AT TIME ZONE 'UTC')::date) AS correlation_date,
    COUNT(*)::bigint AS hal_session_count,
    COALESCE(
      SUM(
        CASE
          WHEN (h.raw_sample->>'total_words') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (h.raw_sample->>'total_words')::numeric
          ELSE 0::numeric
        END
      ),
      0::numeric
    ) AS total_words_logged,
    AVG(
      CASE
        WHEN (h.raw_sample->>'hal_score') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (h.raw_sample->>'hal_score')::double precision
        ELSE NULL::double precision
      END
    ) AS mean_hal_score_raw,
    AVG(
      CASE
        WHEN (h.stylometric_snapshot->>'hal_score_final') ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (h.stylometric_snapshot->>'hal_score_final')::double precision
        ELSE NULL::double precision
      END
    ) AS mean_hal_score_snap
  FROM public.p4_hal_ledger h
  WHERE h.raw_sample ? 'manuscriptId'
    AND (h.raw_sample->>'manuscriptId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  GROUP BY h.tenant_id, (h.raw_sample->>'manuscriptId')::uuid, ((h.created_at AT TIME ZONE 'UTC')::date)
),
effort AS (
  SELECT
    tenant_id,
    manuscript_id,
    correlation_date,
    hal_session_count,
    total_words_logged,
    COALESCE(mean_hal_score_raw, mean_hal_score_snap) AS mean_hal_score
  FROM hal_daily
)
SELECT
  e.correlation_date,
  e.tenant_id,
  e.manuscript_id,
  e.hal_session_count AS writing_hal_sessions,
  e.total_words_logged AS writing_total_words_sampled,
  e.mean_hal_score AS writing_mean_hal_score,
  m.id AS marketing_row_id,
  m.platform AS marketing_platform,
  m.interaction_count AS marketing_interaction_count,
  m.comment_count AS marketing_comment_count,
  m.sales_revenue AS marketing_sales_revenue,
  m.notes AS marketing_notes,
  m.created_at AS marketing_logged_at
FROM effort e
LEFT JOIN public.p4_manual_marketing_data m
  ON m.tenant_id = e.tenant_id
 AND m.manuscript_id = e.manuscript_id
 AND m.recorded_date = e.correlation_date;
  $v$;

  EXECUTE 'GRANT SELECT ON public.p4_v_marketing_hal_correlation TO authenticated';
  EXECUTE 'GRANT SELECT ON public.p4_v_marketing_hal_correlation TO service_role';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'p4_hal_ledger unavailable during view create — skipped';
END $$;
