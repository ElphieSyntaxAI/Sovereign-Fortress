-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
-- =============================================================================
-- Flags HAL/authorship sessions that need manual Teacher or Editor review after a failed consistency quiz.

CREATE TABLE IF NOT EXISTS public.p4_consistency_review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  hal_ledger_id UUID REFERENCES public.p4_hal_ledger (id) ON DELETE SET NULL,
  quiz_run_id UUID NOT NULL,
  quiz_passed BOOLEAN NOT NULL,
  correct_count INT NOT NULL,
  total_questions INT NOT NULL DEFAULT 3,
  requires_manual_review BOOLEAN NOT NULL,
  reason TEXT NOT NULL DEFAULT 'consistency_quiz_failed',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_consistency_review_flags_tenant_time
  ON public.p4_consistency_review_flags (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p4_consistency_review_flags_hal
  ON public.p4_consistency_review_flags (hal_ledger_id)
  WHERE hal_ledger_id IS NOT NULL;

COMMENT ON TABLE public.p4_consistency_review_flags IS
  'Queue signal for Teacher/Editor review when narrative consistency quiz is not passed.';

ALTER TABLE public.p4_consistency_review_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_p4_consistency_review_flags" ON public.p4_consistency_review_flags;
CREATE POLICY "tenant_select_p4_consistency_review_flags"
ON public.p4_consistency_review_flags
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "tenant_insert_p4_consistency_review_flags" ON public.p4_consistency_review_flags;
CREATE POLICY "tenant_insert_p4_consistency_review_flags"
ON public.p4_consistency_review_flags
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);
