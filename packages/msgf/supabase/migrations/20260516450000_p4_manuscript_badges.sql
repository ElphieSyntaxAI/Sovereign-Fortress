-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-5e9b050-20260519T172718Z-internal
-- =============================================================================
-- Badge registry: manuscript certifications (human-authored / human-edited) with JSON verification payloads.

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS project_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_manuscripts.project_completed_at IS
  'Optional author/mark explicit project completion (Fan Hub badges); may also use revision_status AUDITING_COMPLETE per product rules.';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_badge_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_badge_type AS ENUM ('HUMAN_AUTHORED', 'HUMAN_EDITED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_manuscript_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  badge_type public.p4_badge_type NOT NULL,
  verification_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manuscript_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_p4_manuscript_badges_manuscript
  ON public.p4_manuscript_badges (manuscript_id, minted_at DESC);

COMMENT ON TABLE public.p4_manuscript_badges IS
  'Forensic badge mints (HAL + completion, or helper milestones) — public verify via opaque badge id.';

ALTER TABLE public.p4_manuscript_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_manuscript_badges_select_tenant" ON public.p4_manuscript_badges;
CREATE POLICY "p4_manuscript_badges_select_tenant"
ON public.p4_manuscript_badges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = manuscript_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);

DROP POLICY IF EXISTS "p4_manuscript_badges_insert_tenant" ON public.p4_manuscript_badges;
CREATE POLICY "p4_manuscript_badges_insert_tenant"
ON public.p4_manuscript_badges
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = manuscript_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);
