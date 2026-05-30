-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
-- =============================================================================
-- =============================================================================
-- Remediation retry circuit breaker — keyed by file_path + bug_index (1.1.1)
-- After max consecutive failures → PENDING_HUMAN_ARBITRATION (no cron re-queue)
-- Mirrors lib/services/remediation-retry-circuit.ts + heal-queue Zod schemas
-- =============================================================================

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

COMMENT ON TYPE public.msgf_remediation_state IS
  'Heal-queue / consensus remediation lifecycle; PENDING_HUMAN_ARBITRATION blocks scheduled cron.';

ALTER TABLE public.pillar_vectors
  ADD COLUMN IF NOT EXISTS remediation_state public.msgf_remediation_state,
  ADD COLUMN IF NOT EXISTS remediation_attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.msgf_sandbox
  ADD COLUMN IF NOT EXISTS remediation_state public.msgf_remediation_state,
  ADD COLUMN IF NOT EXISTS remediation_attempt_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pillar_vectors.remediation_state IS
  'Circuit breaker state; PENDING_HUMAN_ARBITRATION = max consecutive failures exceeded.';
COMMENT ON COLUMN public.pillar_vectors.remediation_attempt_count IS
  'Consecutive validation/consensus/remediation failures for file_path + bug_index.';

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_remediation_pending_human
  ON public.pillar_vectors (remediation_state)
  WHERE remediation_state = 'PENDING_HUMAN_ARBITRATION';

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_remediation_scheduled
  ON public.pillar_vectors (remediation_state, scheduling_tier)
  WHERE remediation_state = 'SCHEDULED' AND scheduling_tier IS NOT NULL;

-- Backfill: hall rows with high lom_attempts → pending human review
UPDATE public.pillar_vectors v
SET
  remediation_state = 'PENDING_HUMAN_ARBITRATION',
  remediation_attempt_count = GREATEST(v.remediation_attempt_count, 3),
  scheduling_tier = NULL,
  metadata = COALESCE(v.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'heal_queue_pending', false,
      'remediation_circuit_tripped_at', COALESCE(
        v.metadata->>'remediation_circuit_tripped_at',
        NOW()::TEXT
      ),
      'remediation_circuit_reason', COALESCE(
        v.metadata->>'remediation_circuit_reason',
        'backfill: lom_attempts >= 3'
      )
    )
WHERE v.metadata->>'ledger' = 'hall'
  AND COALESCE((v.metadata->>'lom_attempts')::INT, 0) >= 3
  AND (v.remediation_state IS NULL OR v.remediation_state <> 'PENDING_HUMAN_ARBITRATION');
