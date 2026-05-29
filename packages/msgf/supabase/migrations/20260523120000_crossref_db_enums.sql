-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
-- =============================================================================
-- =============================================================================
-- CROSS-REF hardening — Postgres ENUMs + DOMAINs + pillar_vectors typed columns
-- Mirrors packages/msgf/lib/schemas/vault-hall-metadata.ts (Zod contracts).
-- Invalid governance_pillar, vault/hall ledger, or 1.0/1.1/1.1.1 misalignment → RAISE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM types (finite sets — must match Zod z.enum())
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.msgf_governance_pillar AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5', 'P6');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.msgf_constraint_ledger AS ENUM ('vault', 'hall');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.msgf_vault_hall_pillar AS ENUM ('P6');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.msgf_scheduling_tier AS ENUM ('RED', 'YELLOW', 'GREEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.msgf_governance_pillar IS 'V3.0 governance pillar P1–P6; mirrors MsgfGovernancePillarSchema.';
COMMENT ON TYPE public.msgf_constraint_ledger IS 'P6 Vault (positive) vs Hall (negative); mirrors ConstraintLedgerKindSchema.';
COMMENT ON TYPE public.msgf_scheduling_tier IS 'Heal-queue / tier batch cadence; mirrors HealQueueSchedulingTierSchema.';

-- -----------------------------------------------------------------------------
-- DOMAIN types (genealogical slug patterns — mirrors BugIndexLevel*Schema regex)
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE DOMAIN public.msgf_bug_index_level_1 AS TEXT
    CHECK (VALUE ~ '^\d+\.0[_A-Z0-9]+$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE DOMAIN public.msgf_bug_index_level_1_1 AS TEXT
    CHECK (VALUE ~ '^\d+\.\d+[_A-Z0-9]+$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE DOMAIN public.msgf_bug_index_level_1_1_1 AS TEXT
    CHECK (VALUE ~ '^\d+\.\d+\.\d+[_A-Z0-9]+$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON DOMAIN public.msgf_bug_index_level_1 IS 'Genealogical 1.0 category e.g. 1.0_PULSE';
COMMENT ON DOMAIN public.msgf_bug_index_level_1_1 IS 'Genealogical 1.1 branch e.g. 1.1_DEFEND';
COMMENT ON DOMAIN public.msgf_bug_index_level_1_1_1 IS 'Genealogical 1.1.1 instance e.g. 1.1.1_CONSENSUS_VAULT';

-- -----------------------------------------------------------------------------
-- Coherence helpers (shared root across 1.0 / 1.1 / 1.1.1)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.msgf_genealogical_root_from_category(p_cat TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (regexp_match(trim(p_cat), '^(\d+)\.0_', 'i'))[1]::INTEGER;
$$;

CREATE OR REPLACE FUNCTION public.msgf_assert_bug_index_coherent(
  p_cat TEXT,
  p_branch TEXT,
  p_inst TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  r INTEGER;
BEGIN
  r := public.msgf_genealogical_root_from_category(p_cat);
  IF r IS NULL THEN
    RETURN FALSE;
  END IF;
  IF trim(p_branch) !~ ('^' || r::TEXT || '\.\d+[_A-Z0-9]+$') THEN
    RETURN FALSE;
  END IF;
  IF trim(p_inst) !~ ('^' || r::TEXT || '\.\d+\.\d+[_A-Z0-9]+$') THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.msgf_cast_bug_index_level_1(p TEXT)
RETURNS public.msgf_bug_index_level_1
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN trim(p)::public.msgf_bug_index_level_1;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: invalid level_1_category "%" (expected <root>.0_<SLUG>)', p
      USING ERRCODE = 'check_violation';
END;
$$;

CREATE OR REPLACE FUNCTION public.msgf_cast_bug_index_level_1_1(p TEXT)
RETURNS public.msgf_bug_index_level_1_1
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN trim(p)::public.msgf_bug_index_level_1_1;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: invalid level_1_1_branch "%" (expected <root>.<branch>_<SLUG>)', p
      USING ERRCODE = 'check_violation';
END;
$$;

CREATE OR REPLACE FUNCTION public.msgf_cast_bug_index_level_1_1_1(p TEXT)
RETURNS public.msgf_bug_index_level_1_1_1
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN trim(p)::public.msgf_bug_index_level_1_1_1;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: invalid level_1_1_1_instance "%" (expected <root>.<branch>.<instance>_<SLUG>)', p
      USING ERRCODE = 'check_violation';
END;
$$;

-- -----------------------------------------------------------------------------
-- pillar_vectors — typed CROSS-REF columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.pillar_vectors
  ADD COLUMN IF NOT EXISTS governance_pillar public.msgf_governance_pillar,
  ADD COLUMN IF NOT EXISTS vault_hall_pillar public.msgf_vault_hall_pillar,
  ADD COLUMN IF NOT EXISTS constraint_ledger public.msgf_constraint_ledger,
  ADD COLUMN IF NOT EXISTS level_1_category public.msgf_bug_index_level_1,
  ADD COLUMN IF NOT EXISTS level_1_1_branch public.msgf_bug_index_level_1_1,
  ADD COLUMN IF NOT EXISTS level_1_1_1_instance public.msgf_bug_index_level_1_1_1,
  ADD COLUMN IF NOT EXISTS genealogical_root INTEGER;

COMMENT ON COLUMN public.pillar_vectors.governance_pillar IS 'V3.0 pillar P1–P6 (ingest / heal-queue scope).';
COMMENT ON COLUMN public.pillar_vectors.vault_hall_pillar IS 'Constraint ledger tag — always P6 for Vault/Hall rows.';
COMMENT ON COLUMN public.pillar_vectors.constraint_ledger IS 'vault | hall — enforced at insert/update.';
COMMENT ON COLUMN public.pillar_vectors.genealogical_root IS 'Numeric root shared by 1.0 / 1.1 / 1.1.1 slugs.';

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_governance_pillar
  ON public.pillar_vectors (governance_pillar)
  WHERE governance_pillar IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_constraint_ledger
  ON public.pillar_vectors (constraint_ledger)
  WHERE constraint_ledger IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pillar_vectors_genealogical_root
  ON public.pillar_vectors (genealogical_root)
  WHERE genealogical_root IS NOT NULL;

-- scheduling_tier: text → enum (heal-queue migration may have created text column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pillar_vectors'
      AND column_name = 'scheduling_tier'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public.pillar_vectors
      ALTER COLUMN scheduling_tier TYPE public.msgf_scheduling_tier
      USING (
        CASE
          WHEN scheduling_tier IN ('RED', 'YELLOW', 'GREEN') THEN scheduling_tier::public.msgf_scheduling_tier
          ELSE NULL
        END
      );
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pillar_vectors'
      AND column_name = 'scheduling_tier'
  ) THEN
    ALTER TABLE public.pillar_vectors
      ADD COLUMN scheduling_tier public.msgf_scheduling_tier;
  END IF;
END $$;

-- Backfill typed columns from metadata JSONB (skip rows that fail coherence — manual cleanup required)
UPDATE public.pillar_vectors v
SET
  governance_pillar = COALESCE(
    v.governance_pillar,
    NULLIF(v.metadata->>'governance_pillar', '')::public.msgf_governance_pillar,
    NULLIF(v.metadata->>'pillar', '')::public.msgf_governance_pillar
  ),
  vault_hall_pillar = COALESCE(
    v.vault_hall_pillar,
    CASE
      WHEN v.metadata->>'pillar' = 'P6' OR v.metadata->>'index_type' = 'genealogical_bug_index'
        THEN 'P6'::public.msgf_vault_hall_pillar
      ELSE NULL
    END
  ),
  constraint_ledger = COALESCE(
    v.constraint_ledger,
    NULLIF(v.metadata->>'ledger', '')::public.msgf_constraint_ledger
  ),
  level_1_category = COALESCE(
    v.level_1_category,
    public.msgf_cast_bug_index_level_1(COALESCE(
      v.metadata->'bug_index'->>'level_1_category',
      v.metadata->>'category'
    ))
  ),
  level_1_1_branch = COALESCE(
    v.level_1_1_branch,
    public.msgf_cast_bug_index_level_1_1(COALESCE(
      v.metadata->'bug_index'->>'level_1_1_branch',
      v.metadata->>'branch'
    ))
  ),
  level_1_1_1_instance = COALESCE(
    v.level_1_1_1_instance,
    public.msgf_cast_bug_index_level_1_1_1(COALESCE(
      v.metadata->'bug_index'->>'level_1_1_1_instance',
      v.metadata->>'instance_slug'
    ))
  ),
  genealogical_root = COALESCE(
    v.genealogical_root,
    public.msgf_genealogical_root_from_category(
      COALESCE(v.metadata->'bug_index'->>'level_1_category', v.metadata->>'category')
    )
  )
WHERE (
    v.metadata->>'index_type' = 'genealogical_bug_index'
    OR v.metadata->>'ledger' IN ('vault', 'hall')
  )
  AND public.msgf_assert_bug_index_coherent(
    COALESCE(v.metadata->'bug_index'->>'level_1_category', v.metadata->>'category'),
    COALESCE(v.metadata->'bug_index'->>'level_1_1_branch', v.metadata->>'branch'),
    COALESCE(v.metadata->'bug_index'->>'level_1_1_1_instance', v.metadata->>'instance_slug')
  );

-- -----------------------------------------------------------------------------
-- msgf_sandbox — mirror columns (DEV_TEST cold layer)
-- -----------------------------------------------------------------------------

ALTER TABLE public.msgf_sandbox
  ADD COLUMN IF NOT EXISTS governance_pillar public.msgf_governance_pillar,
  ADD COLUMN IF NOT EXISTS vault_hall_pillar public.msgf_vault_hall_pillar,
  ADD COLUMN IF NOT EXISTS constraint_ledger public.msgf_constraint_ledger,
  ADD COLUMN IF NOT EXISTS level_1_category public.msgf_bug_index_level_1,
  ADD COLUMN IF NOT EXISTS level_1_1_branch public.msgf_bug_index_level_1_1,
  ADD COLUMN IF NOT EXISTS level_1_1_1_instance public.msgf_bug_index_level_1_1_1,
  ADD COLUMN IF NOT EXISTS genealogical_root INTEGER,
  ADD COLUMN IF NOT EXISTS scheduling_tier public.msgf_scheduling_tier;

UPDATE public.msgf_sandbox v
SET
  governance_pillar = COALESCE(
    v.governance_pillar,
    NULLIF(v.metadata->>'governance_pillar', '')::public.msgf_governance_pillar,
    NULLIF(v.metadata->>'pillar', '')::public.msgf_governance_pillar
  ),
  vault_hall_pillar = COALESCE(
    v.vault_hall_pillar,
    CASE
      WHEN v.metadata->>'pillar' = 'P6' OR v.metadata->>'index_type' = 'genealogical_bug_index'
        THEN 'P6'::public.msgf_vault_hall_pillar
      ELSE NULL
    END
  ),
  constraint_ledger = COALESCE(
    v.constraint_ledger,
    NULLIF(v.metadata->>'ledger', '')::public.msgf_constraint_ledger
  ),
  level_1_category = COALESCE(
    v.level_1_category,
    public.msgf_cast_bug_index_level_1(COALESCE(
      v.metadata->'bug_index'->>'level_1_category',
      v.metadata->>'category'
    ))
  ),
  level_1_1_branch = COALESCE(
    v.level_1_1_branch,
    public.msgf_cast_bug_index_level_1_1(COALESCE(
      v.metadata->'bug_index'->>'level_1_1_branch',
      v.metadata->>'branch'
    ))
  ),
  level_1_1_1_instance = COALESCE(
    v.level_1_1_1_instance,
    public.msgf_cast_bug_index_level_1_1_1(COALESCE(
      v.metadata->'bug_index'->>'level_1_1_1_instance',
      v.metadata->>'instance_slug'
    ))
  ),
  genealogical_root = COALESCE(
    v.genealogical_root,
    public.msgf_genealogical_root_from_category(
      COALESCE(v.metadata->'bug_index'->>'level_1_category', v.metadata->>'category')
    )
  )
WHERE (
    v.metadata->>'index_type' = 'genealogical_bug_index'
    OR v.metadata->>'ledger' IN ('vault', 'hall')
  )
  AND public.msgf_assert_bug_index_coherent(
    COALESCE(v.metadata->'bug_index'->>'level_1_category', v.metadata->>'category'),
    COALESCE(v.metadata->'bug_index'->>'level_1_1_branch', v.metadata->>'branch'),
    COALESCE(v.metadata->'bug_index'->>'level_1_1_1_instance', v.metadata->>'instance_slug')
  );

-- -----------------------------------------------------------------------------
-- BEFORE INSERT/UPDATE — enforce + mirror metadata (un-bypassable)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.msgf_pillar_vectors_crossref_enforce()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_meta JSONB;
  v_cat TEXT;
  v_branch TEXT;
  v_inst TEXT;
  v_ledger public.msgf_constraint_ledger;
  v_gov public.msgf_governance_pillar;
  v_vhp public.msgf_vault_hall_pillar;
  v_is_crossref BOOLEAN;
BEGIN
  v_meta := COALESCE(NEW.metadata, '{}'::jsonb);
  v_is_crossref :=
    v_meta->>'index_type' = 'genealogical_bug_index'
    OR v_meta->>'ledger' IN ('vault', 'hall')
    OR NEW.constraint_ledger IS NOT NULL;

  IF NOT v_is_crossref THEN
    RETURN NEW;
  END IF;

  -- Ledger
  IF NEW.constraint_ledger IS NOT NULL THEN
    v_ledger := NEW.constraint_ledger;
  ELSIF v_meta->>'ledger' IN ('vault', 'hall') THEN
    v_ledger := (v_meta->>'ledger')::public.msgf_constraint_ledger;
  ELSE
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: constraint_ledger required (vault | hall)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Bug index triple
  v_cat := COALESCE(
    NEW.level_1_category::TEXT,
    v_meta->'bug_index'->>'level_1_category',
    v_meta->>'category'
  );
  v_branch := COALESCE(
    NEW.level_1_1_branch::TEXT,
    v_meta->'bug_index'->>'level_1_1_branch',
    v_meta->>'branch'
  );
  v_inst := COALESCE(
    NEW.level_1_1_1_instance::TEXT,
    v_meta->'bug_index'->>'level_1_1_1_instance',
    v_meta->>'instance_slug'
  );

  IF v_cat IS NULL OR v_branch IS NULL OR v_inst IS NULL THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: level_1_category, level_1_1_branch, level_1_1_1_instance required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT public.msgf_assert_bug_index_coherent(v_cat, v_branch, v_inst) THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: genealogical root misalignment across 1.0 / 1.1 / 1.1.1 (%, %, %)',
      v_cat, v_branch, v_inst
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.level_1_category := public.msgf_cast_bug_index_level_1(v_cat);
  NEW.level_1_1_branch := public.msgf_cast_bug_index_level_1_1(v_branch);
  NEW.level_1_1_1_instance := public.msgf_cast_bug_index_level_1_1_1(v_inst);
  NEW.genealogical_root := public.msgf_genealogical_root_from_category(v_cat);
  NEW.constraint_ledger := v_ledger;
  NEW.vault_hall_pillar := 'P6'::public.msgf_vault_hall_pillar;

  -- Governance pillar
  IF NEW.governance_pillar IS NOT NULL THEN
    v_gov := NEW.governance_pillar;
  ELSIF v_meta->>'governance_pillar' IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6') THEN
    v_gov := (v_meta->>'governance_pillar')::public.msgf_governance_pillar;
  ELSIF v_meta->>'pillar' IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6') THEN
    v_gov := (v_meta->>'pillar')::public.msgf_governance_pillar;
  ELSE
    v_gov := 'P6'::public.msgf_governance_pillar;
  END IF;
  NEW.governance_pillar := v_gov;

  -- Mirror canonical metadata (prevents category/branch drift)
  NEW.metadata := v_meta
    || jsonb_build_object(
      'index_type', 'genealogical_bug_index',
      'ledger', v_ledger::TEXT,
      'pillar', 'P6',
      'governance_pillar', v_gov::TEXT,
      'instance', '1.1.1',
      'category', NEW.level_1_category::TEXT,
      'branch', NEW.level_1_1_branch::TEXT,
      'instance_slug', NEW.level_1_1_1_instance::TEXT,
      'bug_index', jsonb_build_object(
        'level_1_category', NEW.level_1_category::TEXT,
        'level_1_1_branch', NEW.level_1_1_branch::TEXT,
        'level_1_1_1_instance', NEW.level_1_1_1_instance::TEXT
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pillar_vectors_crossref_enforce ON public.pillar_vectors;
CREATE TRIGGER trg_pillar_vectors_crossref_enforce
  BEFORE INSERT OR UPDATE OF metadata, governance_pillar, constraint_ledger,
    level_1_category, level_1_1_branch, level_1_1_1_instance
  ON public.pillar_vectors
  FOR EACH ROW
  EXECUTE FUNCTION public.msgf_pillar_vectors_crossref_enforce();

DROP TRIGGER IF EXISTS trg_msgf_sandbox_crossref_enforce ON public.msgf_sandbox;
CREATE TRIGGER trg_msgf_sandbox_crossref_enforce
  BEFORE INSERT OR UPDATE OF metadata, governance_pillar, constraint_ledger,
    level_1_category, level_1_1_branch, level_1_1_1_instance
  ON public.msgf_sandbox
  FOR EACH ROW
  EXECUTE FUNCTION public.msgf_pillar_vectors_crossref_enforce();

-- -----------------------------------------------------------------------------
-- msgf_incidents.bug_index JSONB — same genealogical contract
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.msgf_incidents_bug_index_enforce()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cat TEXT;
  v_branch TEXT;
  v_inst TEXT;
BEGIN
  IF NEW.bug_index IS NULL OR jsonb_typeof(NEW.bug_index) <> 'object' THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: msgf_incidents.bug_index must be a JSON object'
      USING ERRCODE = 'check_violation';
  END IF;

  v_cat := NEW.bug_index->>'level_1_category';
  v_branch := NEW.bug_index->>'level_1_1_branch';
  v_inst := NEW.bug_index->>'level_1_1_1_instance';

  IF v_cat IS NULL OR v_branch IS NULL OR v_inst IS NULL THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: bug_index must include level_1_category, level_1_1_branch, level_1_1_1_instance'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.msgf_cast_bug_index_level_1(v_cat);
  PERFORM public.msgf_cast_bug_index_level_1_1(v_branch);
  PERFORM public.msgf_cast_bug_index_level_1_1_1(v_inst);

  IF NOT public.msgf_assert_bug_index_coherent(v_cat, v_branch, v_inst) THEN
    RAISE EXCEPTION 'CROSS_REF_VIOLATION: incidents bug_index genealogical misalignment'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.bug_index := jsonb_build_object(
    'level_1_category', trim(v_cat),
    'level_1_1_branch', trim(v_branch),
    'level_1_1_1_instance', trim(v_inst)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_msgf_incidents_bug_index_enforce ON public.msgf_incidents;
CREATE TRIGGER trg_msgf_incidents_bug_index_enforce
  BEFORE INSERT OR UPDATE OF bug_index
  ON public.msgf_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.msgf_incidents_bug_index_enforce();
