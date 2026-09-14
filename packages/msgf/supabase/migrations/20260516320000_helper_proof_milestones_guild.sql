-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
-- =============================================================================
-- Helper proof: three milestone artifacts per manuscript (project) + author "verified human flow" + guild tier counter.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_helper_milestone_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_helper_milestone_type AS ENUM ('SEED', 'GROWTH', 'HARVEST');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  milestone_type public.p4_helper_milestone_type NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, milestone_type)
);

CREATE INDEX IF NOT EXISTS idx_p4_project_milestones_project
  ON public.p4_project_milestones (project_id, milestone_type);

COMMENT ON TABLE public.p4_project_milestones IS
  'Helper labor proof: SEED / GROWTH / HARVEST artifacts before project completion or author payout verification.';

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS verified_human_flow_at TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_manuscripts.verified_human_flow_at IS
  'Author confirmed three-stage helper milestones (human labor) — drives guild verified project_count.';

-- ---------------------------------------------------------------------------
-- Guild tier counter: only verified-human-flow manuscripts bump this (via trigger).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.p4_guild_tier_counters (
  tenant_id UUID PRIMARY KEY,
  project_count INT NOT NULL DEFAULT 0 CHECK (project_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.p4_guild_tier_counters IS
  'Verified human-flow project completions per tenant (guild tier progression).';

ALTER TABLE public.p4_guild_tier_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_guild_tier_counters_select_tenant" ON public.p4_guild_tier_counters;
CREATE POLICY "p4_guild_tier_counters_select_tenant"
ON public.p4_guild_tier_counters
FOR SELECT
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- No direct UPDATE for authors — increments happen via trigger on manuscripts.

-- ---------------------------------------------------------------------------
-- Milestones RLS: tenant-scoped via manuscript
-- ---------------------------------------------------------------------------

ALTER TABLE public.p4_project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_project_milestones_select_tenant" ON public.p4_project_milestones;
CREATE POLICY "p4_project_milestones_select_tenant"
ON public.p4_project_milestones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = project_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);

DROP POLICY IF EXISTS "p4_project_milestones_insert_tenant" ON public.p4_project_milestones;
CREATE POLICY "p4_project_milestones_insert_tenant"
ON public.p4_project_milestones
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = project_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);

DROP POLICY IF EXISTS "p4_project_milestones_update_tenant" ON public.p4_project_milestones;
CREATE POLICY "p4_project_milestones_update_tenant"
ON public.p4_project_milestones
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = project_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = project_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);

DROP POLICY IF EXISTS "p4_project_milestones_delete_tenant" ON public.p4_project_milestones;
CREATE POLICY "p4_project_milestones_delete_tenant"
ON public.p4_project_milestones
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = project_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);

-- ---------------------------------------------------------------------------
-- Triggers: milestone gate on author verify + guild bump once
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_enforce_helper_milestones_before_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.verified_human_flow_at IS NOT DISTINCT FROM OLD.verified_human_flow_at THEN
    RETURN NEW;
  END IF;

  IF OLD.verified_human_flow_at IS NOT NULL AND NEW.verified_human_flow_at IS DISTINCT FROM OLD.verified_human_flow_at THEN
    RAISE EXCEPTION 'verified_human_flow_at is immutable once set';
  END IF;

  IF NEW.verified_human_flow_at IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.p4_project_milestones pm
      WHERE pm.project_id = NEW.id AND pm.milestone_type = 'SEED' AND length(trim(pm.file_url)) > 0
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.p4_project_milestones pm
      WHERE pm.project_id = NEW.id AND pm.milestone_type = 'GROWTH' AND length(trim(pm.file_url)) > 0
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.p4_project_milestones pm
      WHERE pm.project_id = NEW.id AND pm.milestone_type = 'HARVEST' AND length(trim(pm.file_url)) > 0
    ) THEN
      RAISE EXCEPTION 'HelperProof: SEED, GROWTH, and HARVEST milestones must all be uploaded before author verification';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p4_manuscripts_helper_milestones_verify ON public.p4_manuscripts;
CREATE TRIGGER trg_p4_manuscripts_helper_milestones_verify
BEFORE UPDATE OF verified_human_flow_at ON public.p4_manuscripts
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_helper_milestones_before_verify();

CREATE OR REPLACE FUNCTION public.trg_bump_guild_on_verified_human_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.verified_human_flow_at IS NULL
     AND NEW.verified_human_flow_at IS NOT NULL THEN
    INSERT INTO public.p4_guild_tier_counters (tenant_id, project_count, updated_at)
    VALUES (NEW.tenant_id, 1, now())
    ON CONFLICT (tenant_id) DO UPDATE
      SET project_count = public.p4_guild_tier_counters.project_count + 1,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_p4_manuscripts_guild_bump_verify ON public.p4_manuscripts;
CREATE TRIGGER trg_p4_manuscripts_guild_bump_verify
AFTER UPDATE OF verified_human_flow_at ON public.p4_manuscripts
FOR EACH ROW
EXECUTE FUNCTION public.trg_bump_guild_on_verified_human_flow();
