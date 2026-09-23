-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
-- =============================================================================
-- Editor hub quality gate: `report_json.continuity_score` on `p4_revision_reports` (latest row SSOT).

ALTER TABLE public.p4_revision_reports
  ADD COLUMN IF NOT EXISTS report_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.p4_revision_reports.report_json IS
  'Structured payload for gates (e.g. continuity_score). Finding-specific details remain in `details`.';

-- Backfill continuity on historical AUDIT_SUMMARY rows (details.auditScore was the prior SSOT).
UPDATE public.p4_revision_reports r
SET report_json =
  COALESCE(r.report_json, '{}'::jsonb)
  || jsonb_build_object('continuity_score', (NULLIF(trim(r.details ->> 'auditScore'), ''))::double precision)
WHERE r.finding_type = 'AUDIT_SUMMARY'
  AND (r.details ? 'auditScore')
  AND (r.details ->> 'auditScore') IS NOT NULL
  AND trim(r.details ->> 'auditScore') <> ''
  AND NOT (COALESCE(r.report_json, '{}'::jsonb) ? 'continuity_score');
