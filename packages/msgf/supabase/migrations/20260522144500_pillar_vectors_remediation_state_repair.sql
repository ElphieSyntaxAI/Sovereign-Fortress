-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
-- =============================================================================
-- Repair: ensure remediation circuit columns exist on pillar_vectors (heal-queue solo probe).
-- Idempotent — safe if 20260523140000_remediation_circuit_breaker already applied fully.

DO $$ BEGIN
  CREATE TYPE public.msgf_remediation_state AS ENUM (
    'ACTIVE',
    'SCHEDULED',
    'PENDING_HUMAN_ARBITRATION',
    'RESOLVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pillar_vectors
  ADD COLUMN IF NOT EXISTS remediation_state public.msgf_remediation_state,
  ADD COLUMN IF NOT EXISTS remediation_attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.msgf_sandbox
  ADD COLUMN IF NOT EXISTS remediation_state public.msgf_remediation_state,
  ADD COLUMN IF NOT EXISTS remediation_attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_remediation_pending_human
  ON public.pillar_vectors (remediation_state)
  WHERE remediation_state = 'PENDING_HUMAN_ARBITRATION';

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_remediation_scheduled
  ON public.pillar_vectors (remediation_state, scheduling_tier)
  WHERE remediation_state = 'SCHEDULED' AND scheduling_tier IS NOT NULL;
