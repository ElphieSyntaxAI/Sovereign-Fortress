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
-- Legacy Docker `hal_ledger` + `projects` / `content_items` field parity on Supabase `p4_*` tables.
-- Safe idempotent adds — nullable columns for ETL / dual-write bridges; BFF continues to use primary p4 columns.

-- ---------------------------------------------------------------------------
-- p4_hal_ledger ↔ legacy public.hal_ledger (schema.sql)
-- Legacy: hal_id, author_id, content_hash, keystroke_data JSONB, is_ai_generated,
--         session_start, session_end, created_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_hal_ledger
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS keystroke_data_legacy JSONB,
  ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS session_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_end TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_hal_ledger.content_hash IS
  'Parity with legacy hal_ledger.content_hash (opaque chunk / sample fingerprint).';

COMMENT ON COLUMN public.p4_hal_ledger.keystroke_data_legacy IS
  'Parity with legacy hal_ledger.keystroke_data JSONB; canonical typed stream remains keystroke_latency_ms + raw_sample.';

COMMENT ON COLUMN public.p4_hal_ledger.is_ai_generated IS
  'Parity with legacy hal_ledger.is_ai_generated.';

COMMENT ON COLUMN public.p4_hal_ledger.session_start IS
  'Parity with legacy hal_ledger.session_start; canonical session UUID remains session_id.';

COMMENT ON COLUMN public.p4_hal_ledger.session_end IS
  'Parity with legacy hal_ledger.session_end.';

-- ---------------------------------------------------------------------------
-- p4_manuscripts ↔ legacy projects / content_items (schema.sql)
-- projects: title, description, status, is_public, target_word_count
-- content_items: storage_url, item_type, minimum_tier_required, is_public
-- ---------------------------------------------------------------------------
ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS workspace_status TEXT,
  ADD COLUMN IF NOT EXISTS project_description TEXT,
  ADD COLUMN IF NOT EXISTS target_word_count INT,
  ADD COLUMN IF NOT EXISTS is_public_workspace BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS content_storage_url TEXT,
  ADD COLUMN IF NOT EXISTS content_item_type TEXT,
  ADD COLUMN IF NOT EXISTS minimum_tier_required INT;

COMMENT ON COLUMN public.p4_manuscripts.workspace_status IS
  'Parity with legacy projects.status (e.g. wip, draft_complete, published) — distinct from p4_revision_status.';

COMMENT ON COLUMN public.p4_manuscripts.project_description IS
  'Parity with legacy projects.description.';

COMMENT ON COLUMN public.p4_manuscripts.target_word_count IS
  'Parity with legacy projects.target_word_count.';

COMMENT ON COLUMN public.p4_manuscripts.is_public_workspace IS
  'Parity with legacy projects.is_public / content visibility flags.';

COMMENT ON COLUMN public.p4_manuscripts.content_storage_url IS
  'Parity with legacy content_items.storage_url when a manuscript maps to a stored asset.';

COMMENT ON COLUMN public.p4_manuscripts.content_item_type IS
  'Parity with legacy content_items.item_type (book, video, game_asset, etc.).';

COMMENT ON COLUMN public.p4_manuscripts.minimum_tier_required IS
  'Parity with legacy content_items.minimum_tier_required (references tiers.tier_id conceptually).';
