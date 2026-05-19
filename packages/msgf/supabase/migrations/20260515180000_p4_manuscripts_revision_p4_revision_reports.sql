-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
-- =============================================================================
-- Manuscript revision lifecycle, lock tiers, and structured revision audit reports.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_revision_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_revision_status AS ENUM (
      'DRAFTING',
      'LOCKED',
      'AUDITING',
      'READY_FOR_EDITOR'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_lock_tier' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_lock_tier AS ENUM (
      '4w',
      '6w',
      '8w'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_manuscripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT,
  /** Full plain text used for revision audit embedding (keep in sync with ingested source when possible). */
  body_text TEXT,
  revision_status public.p4_revision_status NOT NULL DEFAULT 'DRAFTING',
  lock_tier public.p4_lock_tier,
  lock_expires_at TIMESTAMPTZ,
  revision_count INT NOT NULL DEFAULT 0,
  /** Aggregate alignment score from last audit [0, 1]; higher = stronger canon↔manuscript match. */
  audit_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_audit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_manuscripts_tenant_status
  ON public.p4_manuscripts (tenant_id, revision_status);

CREATE INDEX IF NOT EXISTS idx_p4_manuscripts_tenant_updated
  ON public.p4_manuscripts (tenant_id, updated_at DESC);

COMMENT ON TABLE public.p4_manuscripts IS
  'Author manuscripts: revision_status / lock_tier / audit_score drive editor handoff gates.';

ALTER TABLE public.p4_manuscripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_manuscripts_select_tenant" ON public.p4_manuscripts;
CREATE POLICY "p4_manuscripts_select_tenant"
ON public.p4_manuscripts
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_manuscripts_insert_tenant" ON public.p4_manuscripts;
CREATE POLICY "p4_manuscripts_insert_tenant"
ON public.p4_manuscripts
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_manuscripts_update_tenant" ON public.p4_manuscripts;
CREATE POLICY "p4_manuscripts_update_tenant"
ON public.p4_manuscripts
FOR UPDATE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
)
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_manuscripts_delete_tenant" ON public.p4_manuscripts;
CREATE POLICY "p4_manuscripts_delete_tenant"
ON public.p4_manuscripts
FOR DELETE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

-- ---------------------------------------------------------------------------
-- p4_revision_reports: findings from manuscript vs canon (lore) semantic audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.p4_revision_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL CHECK (
    finding_type IN (
      'CANON_MANUSCRIPT_GAP',
      'HIGH_DYNAMIC_TENSION',
      'AUDIT_SUMMARY'
    )
  ),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'critical')),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  chunk_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  cosine_similarity DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_revision_reports_manuscript
  ON public.p4_revision_reports (manuscript_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p4_revision_reports_tenant
  ON public.p4_revision_reports (tenant_id, created_at DESC);

COMMENT ON TABLE public.p4_revision_reports IS
  'Revision audit: canon (lore) vs manuscript similarity and dynamic (plot/character) tension signals.';

ALTER TABLE public.p4_revision_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_revision_reports_select_tenant" ON public.p4_revision_reports;
CREATE POLICY "p4_revision_reports_select_tenant"
ON public.p4_revision_reports
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_revision_reports_insert_tenant" ON public.p4_revision_reports;
CREATE POLICY "p4_revision_reports_insert_tenant"
ON public.p4_revision_reports
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);
