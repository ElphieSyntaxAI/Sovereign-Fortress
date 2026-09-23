-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
-- =============================================================================
-- Cooldown gate track for manuscripts (SSOT: docs/AUTHOR_ECOSYSTEM_ROADMAP.md, alias docs/AUTHOR_ROADMAP.md).
-- NOTE: `p4_manuscripts.revision_status` already exists (p4_revision_status: DRAFTING, LOCKED, COOLDOWN_LOCKED, …).
-- This migration adds a *parallel* gate: `cooldown_revision_status` (ACTIVE | LOCKED | AUDIT_COMPLETE),
-- `locked_until`, `cooldown_duration`, RLS-hardened UPDATE, and expiry helpers.

-- ---------------------------------------------------------------------------
-- Enum: ACTIVE / LOCKED / AUDIT_COMPLETE (roadmap MSGF-style gate)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_manuscript_cooldown_revision_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_manuscript_cooldown_revision_status AS ENUM (
      'ACTIVE',
      'LOCKED',
      'AUDIT_COMPLETE'
    );
  END IF;
END $$;

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS cooldown_revision_status public.p4_manuscript_cooldown_revision_status
    NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS cooldown_duration INTERVAL;

COMMENT ON COLUMN public.p4_manuscripts.cooldown_revision_status IS
  'SSOT cooldown gate (ACTIVE/LOCKED/AUDIT_COMPLETE). Distinct from editorial lifecycle column revision_status (p4_revision_status). See docs/AUTHOR_ECOSYSTEM_ROADMAP.md.';

COMMENT ON COLUMN public.p4_manuscripts.locked_until IS
  'While cooldown_revision_status = LOCKED: no tenant updates until NOW() >= locked_until (RLS). Trigger promotes to AUDIT_COMPLETE when expired.';

COMMENT ON COLUMN public.p4_manuscripts.cooldown_duration IS
  'Optional wall-clock duration of the lock window for UX / reporting; locked_until is authoritative for RLS.';

CREATE INDEX IF NOT EXISTS idx_p4_manuscripts_cooldown_locked_until
  ON public.p4_manuscripts (locked_until)
  WHERE cooldown_revision_status = 'LOCKED';

-- ---------------------------------------------------------------------------
-- RLS: forbid authenticated UPDATE while LOCKED and not yet expired
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "p4_manuscripts_update_tenant" ON public.p4_manuscripts;

CREATE POLICY "p4_manuscripts_update_tenant"
  ON public.p4_manuscripts
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
    AND (
      cooldown_revision_status IS DISTINCT FROM 'LOCKED'
      OR locked_until IS NULL
      OR NOW() >= locked_until
    )
  )
  WITH CHECK (
    tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  );

-- ---------------------------------------------------------------------------
-- check_cooldown_expiry(): bulk-flip expired LOCKED rows to AUDIT_COMPLETE
-- (Call from pg_cron, Edge scheduler, or any SECURITY DEFINER job.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_cooldown_expiry()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.p4_manuscripts
  SET
    cooldown_revision_status = 'AUDIT_COMPLETE',
    locked_until = NULL,
    updated_at = NOW()
  WHERE cooldown_revision_status = 'LOCKED'
    AND locked_until IS NOT NULL
    AND locked_until <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.check_cooldown_expiry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_cooldown_expiry() TO service_role;

COMMENT ON FUNCTION public.check_cooldown_expiry IS
  'Sets cooldown_revision_status from LOCKED to AUDIT_COMPLETE when locked_until <= now(). Returns rows updated.';

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: if this row is still LOCKED but lock has expired, promote row
-- so the first post-expiry UPDATE succeeds under RLS without a separate batch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_cooldown_expiry_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cooldown_revision_status = 'LOCKED'
       AND OLD.locked_until IS NOT NULL
       AND OLD.locked_until <= NOW() THEN
      NEW.cooldown_revision_status := 'AUDIT_COMPLETE';
      NEW.locked_until := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_cooldown_expiry_row() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_p4_manuscripts_check_cooldown_expiry ON public.p4_manuscripts;
CREATE TRIGGER trg_p4_manuscripts_check_cooldown_expiry
  BEFORE UPDATE ON public.p4_manuscripts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cooldown_expiry_row();

COMMENT ON TRIGGER trg_p4_manuscripts_check_cooldown_expiry ON public.p4_manuscripts IS
  'When a row is updated after lock expiry, promotes cooldown_revision_status to AUDIT_COMPLETE before RLS WITH CHECK. Pair with public.check_cooldown_expiry() for time-based flips without a write.';
