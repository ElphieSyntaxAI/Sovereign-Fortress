-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
-- =============================================================================
-- Apprentice matching: helpers queue, per-manuscript projects / billing state, revision-lock completion tally, genre.

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS revision_lock_cycles_completed INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.p4_manuscripts.revision_lock_cycles_completed IS
  'Incremented when a revision lock cycle completes (released from LOCKED); used for apprentice eligibility.';

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS genre_primary TEXT;

COMMENT ON COLUMN public.p4_manuscripts.genre_primary IS
  'Primary genre label for apprentice genre alignment (e.g. Epic Fantasy).';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_helper_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_helper_status AS ENUM ('AVAILABLE', 'MATCHED', 'PAUSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'APPRENTICE_TRANSLATOR',
  genre_tags TEXT[] NOT NULL DEFAULT '{}',
  project_count INT NOT NULL DEFAULT 0 CHECK (project_count >= 0),
  status public.p4_helper_status NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_helpers_status_project_count
  ON public.p4_helpers (status, project_count)
  WHERE status = 'AVAILABLE';

COMMENT ON TABLE public.p4_helpers IS
  'Apprentice / helper pool for subsidized matching (genre tags, capacity).';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_project_billing_state' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_project_billing_state AS ENUM ('STANDARD', 'SUBSIDIZED_APPRENTICE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  billing_state public.p4_project_billing_state NOT NULL DEFAULT 'STANDARD',
  matched_apprentice_helper_id UUID REFERENCES public.p4_helpers (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manuscript_id)
);

CREATE INDEX IF NOT EXISTS idx_p4_projects_tenant ON public.p4_projects (tenant_id, billing_state);

COMMENT ON TABLE public.p4_projects IS
  'Per-manuscript billing / apprentice lock (SUBSIDIZED_APPRENTICE skips author billing).';

ALTER TABLE public.p4_helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p4_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_helpers_select_authenticated" ON public.p4_helpers;
CREATE POLICY "p4_helpers_select_authenticated"
ON public.p4_helpers
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "p4_projects_select_tenant" ON public.p4_projects;
CREATE POLICY "p4_projects_select_tenant"
ON public.p4_projects
FOR SELECT
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_projects_insert_tenant" ON public.p4_projects;
CREATE POLICY "p4_projects_insert_tenant"
ON public.p4_projects
FOR INSERT
TO authenticated
WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_projects_update_tenant" ON public.p4_projects;
CREATE POLICY "p4_projects_update_tenant"
ON public.p4_projects
FOR UPDATE
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'))
WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));
