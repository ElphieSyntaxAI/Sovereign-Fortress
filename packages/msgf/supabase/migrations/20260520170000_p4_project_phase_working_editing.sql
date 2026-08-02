-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
-- =============================================================================
-- Rename hub phases: working | editing | finished + revision / wiki lock timestamps.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'p4_project_phase' AND e.enumlabel = 'idea'
  ) THEN
    ALTER TYPE public.p4_project_phase RENAME VALUE 'idea' TO 'working';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'p4_project_phase' AND e.enumlabel = 'wip'
  ) THEN
    ALTER TYPE public.p4_project_phase RENAME VALUE 'wip' TO 'editing';
  END IF;
END $$;

ALTER TABLE public.p4_manuscripts
  ALTER COLUMN project_phase SET DEFAULT 'working';

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS revisions_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wiki_revision_locked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_manuscripts.revisions_completed_at IS
  'Set when author completes vault revision cooldown (unlock after revision reports).';
COMMENT ON COLUMN public.p4_manuscripts.wiki_revision_locked_at IS
  'Set when author confirms Finished revisions — wiki at this point requires admin unlock to edit.';

COMMENT ON COLUMN public.p4_manuscripts.project_phase IS
  'Author hub: working | editing | finished. Finished only via finish-revisions; editing requires active revision cooldown lock.';

CREATE TABLE IF NOT EXISTS public.p4_wiki_unlock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  requester_email TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.p4_wiki_unlock_requests IS
  'Author requests to edit wiki after revision lock; admin verifies via email workflow.';
