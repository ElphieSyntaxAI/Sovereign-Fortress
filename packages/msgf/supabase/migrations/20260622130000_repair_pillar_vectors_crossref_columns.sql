-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
-- =============================================================================
-- Repair: pillar_vectors CROSS-REF columns (idempotent).
-- Some environments recorded 20260523120000 as applied without columns/types present.

DO $$ BEGIN
  CREATE TYPE public.msgf_governance_pillar AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5', 'P6');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.msgf_constraint_ledger AS ENUM ('vault', 'hall');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.msgf_vault_hall_pillar AS ENUM ('P6');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE DOMAIN public.msgf_bug_index_level_1 AS TEXT
    CHECK (VALUE ~ '^\d+\.0[_A-Z0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE DOMAIN public.msgf_bug_index_level_1_1 AS TEXT
    CHECK (VALUE ~ '^\d+\.\d+[_A-Z0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE DOMAIN public.msgf_bug_index_level_1_1_1 AS TEXT
    CHECK (VALUE ~ '^\d+\.\d+\.\d+[_A-Z0-9]+$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.pillar_vectors
  ADD COLUMN IF NOT EXISTS governance_pillar public.msgf_governance_pillar,
  ADD COLUMN IF NOT EXISTS vault_hall_pillar public.msgf_vault_hall_pillar,
  ADD COLUMN IF NOT EXISTS constraint_ledger public.msgf_constraint_ledger,
  ADD COLUMN IF NOT EXISTS level_1_category public.msgf_bug_index_level_1,
  ADD COLUMN IF NOT EXISTS level_1_1_branch public.msgf_bug_index_level_1_1,
  ADD COLUMN IF NOT EXISTS level_1_1_1_instance public.msgf_bug_index_level_1_1_1,
  ADD COLUMN IF NOT EXISTS genealogical_root INTEGER;

NOTIFY pgrst, 'reload schema';
