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
-- Typed ledger entries for publisher-facing reports (COMMENT | SUGGESTION | STRUCTURAL_NOTE).
-- Retains legacy columns: tenant_id, event_kind, payload, created_at.

DO $$
BEGIN
  CREATE TYPE public.p4_editor_ledger_entry_type AS ENUM (
    'COMMENT',
    'SUGGESTION',
    'STRUCTURAL_NOTE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'p4_editor_ledger'
      AND column_name = 'editor_user_id'
  ) THEN
    ALTER TABLE public.p4_editor_ledger RENAME COLUMN editor_user_id TO editor_id;
  END IF;
END $$;

ALTER TABLE public.p4_editor_ledger
  ADD COLUMN IF NOT EXISTS type public.p4_editor_ledger_entry_type,
  ADD COLUMN IF NOT EXISTS char_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ;

UPDATE public.p4_editor_ledger
SET
  "timestamp" = COALESCE("timestamp", created_at),
  type = COALESCE(
    type,
    CASE
      WHEN event_kind = 'POEE' THEN 'SUGGESTION'::public.p4_editor_ledger_entry_type
      WHEN event_kind = 'POTENTIAL_AI_INJECTION' THEN 'STRUCTURAL_NOTE'::public.p4_editor_ledger_entry_type
      ELSE 'COMMENT'::public.p4_editor_ledger_entry_type
    END
  ),
  char_count = CASE
    WHEN event_kind = 'POEE' THEN
      COALESCE((payload ->> 'original_text_len')::integer, 0)
      + COALESCE((payload ->> 'replacement_text_len')::integer, 0)
    WHEN event_kind = 'POTENTIAL_AI_INJECTION' THEN
      GREATEST(LENGTH(COALESCE(payload ->> 'reason', '')), 0)
    ELSE char_count
  END;

ALTER TABLE public.p4_editor_ledger
  ALTER COLUMN "timestamp" SET DEFAULT NOW(),
  ALTER COLUMN "timestamp" SET NOT NULL;

ALTER TABLE public.p4_editor_ledger
  ALTER COLUMN type SET DEFAULT 'COMMENT'::public.p4_editor_ledger_entry_type,
  ALTER COLUMN type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_p4_editor_ledger_manuscript_editor
  ON public.p4_editor_ledger (manuscript_id, editor_id);

COMMENT ON COLUMN public.p4_editor_ledger.type IS
  'Ledger entry class: COMMENT, SUGGESTION (incl. legacy POEE), or STRUCTURAL_NOTE (incl. security flags).';

COMMENT ON COLUMN public.p4_editor_ledger.char_count IS
  'Characters attributed to this entry (e.g. original+replacement for suggestions).';

COMMENT ON COLUMN public.p4_editor_ledger."timestamp" IS
  'When the editorial action occurred (publisher-facing clock; defaults to created_at).';
