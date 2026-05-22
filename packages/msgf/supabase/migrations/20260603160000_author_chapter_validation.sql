-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
-- =============================================================================
-- Author Ecosystem — Chapter constraint engine (World Bible + Trope/Sensitivity)
--
-- Backs the integration verification suite at
--   packages/msgf/tests/author-logic-validation.test.ts
-- and the POST /api/msgf/author/chapter-validation route handler.
--
-- Adds:
--   * public.author_chapter_validations  — append-only audit row per call
--   * public.author_tension_ledger       — monotonic per-manuscript tension state
--   * public.author_cultural_omens       — append-only omen events from taboo breaches
--
-- Multitenancy: all three tables are scoped by `tenant_id` (operational slug — e.g.
-- "author_ecosystem", a UUID, etc.). RLS allows the owning tenant to read its own
-- rows; mutation is restricted to the service role (the validation route uses the
-- admin client, so RLS is bypassed for writes — same pattern as `state_beats`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Append-only validation log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.author_chapter_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  /**
   * Structural exceptions found against World Bible §1 (immutable / "read-only"
   * physical / planetary / spatial laws). Empty array means the chapter passed
   * the Static Ledger check.
   *
   * Shape:
   *   [{ rule_id, rule_category, message, offending_field, expected, actual }]
   */
  structural_exceptions JSONB NOT NULL DEFAULT '[]'::JSONB,
  /**
   * Cultural taboos triggered (Trope/Sensitivity Sheet §1.0–§2.0). Each entry
   * mirrors the row that was inserted into `author_cultural_omens` so the
   * audit log is self-contained.
   *
   * Shape:
   *   [{ taboo_id, severity, omen_pattern, offending_actor }]
   */
  omens_triggered JSONB NOT NULL DEFAULT '[]'::JSONB,
  tension_before INT NOT NULL DEFAULT 0,
  tension_after INT NOT NULL DEFAULT 0,
  /** Free-form payload from caller; lets reviewers replay edge cases. */
  request_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.author_chapter_validations IS
  'Append-only audit log for /api/msgf/author/chapter-validation — one row per call.';

CREATE INDEX IF NOT EXISTS idx_author_chapter_validations_tenant_manuscript
  ON public.author_chapter_validations (tenant_id, manuscript_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_author_chapter_validations_chapter
  ON public.author_chapter_validations (tenant_id, manuscript_id, chapter_id);

ALTER TABLE public.author_chapter_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS author_chapter_validations_tenant_select
  ON public.author_chapter_validations;
CREATE POLICY author_chapter_validations_tenant_select
  ON public.author_chapter_validations
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = COALESCE(auth.jwt() ->> 'tenant_id', '')
    OR tenant_id = COALESCE(
      (auth.jwt() -> 'user_metadata') ->> 'tenant_id',
      ''
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Tension ledger — per-manuscript state (monotonic upward by design)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.author_tension_ledger (
  manuscript_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tension_level INT NOT NULL DEFAULT 0
    CHECK (tension_level >= 0 AND tension_level <= 1000),
  /** Last chapter that mutated the ledger — for traceability. */
  last_chapter_id TEXT,
  /** Cumulative count of taboo-triggered events that contributed to this state. */
  cultural_omen_count INT NOT NULL DEFAULT 0
    CHECK (cultural_omen_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.author_tension_ledger IS
  'Per-manuscript narrative-tension state. Bumped by Trope/Sensitivity taboo breaches.';

CREATE INDEX IF NOT EXISTS idx_author_tension_ledger_tenant
  ON public.author_tension_ledger (tenant_id);

ALTER TABLE public.author_tension_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS author_tension_ledger_tenant_select
  ON public.author_tension_ledger;
CREATE POLICY author_tension_ledger_tenant_select
  ON public.author_tension_ledger
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = COALESCE(auth.jwt() ->> 'tenant_id', '')
    OR tenant_id = COALESCE(
      (auth.jwt() -> 'user_metadata') ->> 'tenant_id',
      ''
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Cultural omens — append-only event stream
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.author_cultural_omens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  taboo_id TEXT NOT NULL,
  /**
   * Pattern name from the Trope/Sensitivity Sheet — e.g. "raven_circles_overhead",
   * "wind_dies_suddenly". Surfaced to the author so the omen can be planted in
   * the next revision pass.
   */
  omen_pattern TEXT NOT NULL,
  severity INT NOT NULL CHECK (severity >= 1 AND severity <= 10),
  offending_actor TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.author_cultural_omens IS
  'Append-only Cultural_Omen events triggered by cultural-taboo breaches in author chapters.';

CREATE INDEX IF NOT EXISTS idx_author_cultural_omens_manuscript
  ON public.author_cultural_omens (tenant_id, manuscript_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_author_cultural_omens_taboo
  ON public.author_cultural_omens (tenant_id, taboo_id);

ALTER TABLE public.author_cultural_omens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS author_cultural_omens_tenant_select
  ON public.author_cultural_omens;
CREATE POLICY author_cultural_omens_tenant_select
  ON public.author_cultural_omens
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = COALESCE(auth.jwt() ->> 'tenant_id', '')
    OR tenant_id = COALESCE(
      (auth.jwt() -> 'user_metadata') ->> 'tenant_id',
      ''
    )
  );
