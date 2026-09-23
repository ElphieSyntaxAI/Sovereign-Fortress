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
-- =============================================================================
-- A1: Vault quarantine status — poisoned wins excluded from positive retrieval
-- until HITL demote/restore (see fix-engine-pitfalls.md).
-- =============================================================================

ALTER TABLE public.pillar_vectors
  ADD COLUMN IF NOT EXISTS quarantine_status TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_sentry_issue_id TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pillar_vectors_quarantine_status_check'
  ) THEN
    ALTER TABLE public.pillar_vectors
      ADD CONSTRAINT pillar_vectors_quarantine_status_check
      CHECK (quarantine_status IN ('NONE', 'QUARANTINED', 'DEMOTED_HALL', 'RESTORED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_quarantine_active
  ON public.pillar_vectors (quarantine_status)
  WHERE quarantine_status IN ('QUARANTINED', 'DEMOTED_HALL');

COMMENT ON COLUMN public.pillar_vectors.quarantine_status IS
  'NONE/RESTORED = eligible Vault retrieval; QUARANTINED = blocked pending HITL; DEMOTED_HALL = demoted.';

-- Mirror on DEV_TEST sandbox cold layer
ALTER TABLE public.msgf_sandbox
  ADD COLUMN IF NOT EXISTS quarantine_status TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_sentry_issue_id TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'msgf_sandbox_quarantine_status_check'
  ) THEN
    ALTER TABLE public.msgf_sandbox
      ADD CONSTRAINT msgf_sandbox_quarantine_status_check
      CHECK (quarantine_status IN ('NONE', 'QUARANTINED', 'DEMOTED_HALL', 'RESTORED'));
  END IF;
END $$;
