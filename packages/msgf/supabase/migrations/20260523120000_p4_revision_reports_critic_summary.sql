-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
-- =============================================================================
-- Allow Critic (Sensitivity) manuscript pass rows on revision reports.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.p4_revision_reports'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%finding_type%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.p4_revision_reports DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.p4_revision_reports
  ADD CONSTRAINT p4_revision_reports_finding_type_check CHECK (
    finding_type IN (
      'CANON_MANUSCRIPT_GAP',
      'HIGH_DYNAMIC_TENSION',
      'AUDIT_SUMMARY',
      'CRITIC_SUMMARY'
    )
  );

COMMENT ON TABLE public.p4_revision_reports IS
  'Revision audit: canon vs manuscript similarity, dynamic tension, aggregate AUDIT_SUMMARY, and optional CRITIC_SUMMARY (market/theme/genre tone).';
