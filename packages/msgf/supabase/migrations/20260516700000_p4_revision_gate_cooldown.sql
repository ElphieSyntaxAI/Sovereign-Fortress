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
-- P3 Revision gate: planning sync rapid-repeat cooldown (COOLDOWN_LOCKED) + timestamps.

DO $migration$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'p4_revision_status'
      AND e.enumlabel = 'COOLDOWN_LOCKED'
  ) THEN
    ALTER TYPE public.p4_revision_status ADD VALUE 'COOLDOWN_LOCKED';
  END IF;
END $migration$;

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS planning_last_synced_at TIMESTAMPTZ;

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS revision_cooldown_until TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_manuscripts.planning_last_synced_at IS
  'Last successful Planning Command Center → sync-session with substantive writes (outline/lore/plot vectors).';

COMMENT ON COLUMN public.p4_manuscripts.revision_cooldown_until IS
  'When set with revision_status COOLDOWN_LOCKED: Librarian revision audit / report blocked until this instant (BFF lazy release).';
