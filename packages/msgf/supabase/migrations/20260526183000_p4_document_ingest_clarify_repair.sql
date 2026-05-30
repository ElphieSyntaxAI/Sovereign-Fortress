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
-- Repair: clarify columns may be missing if 20260525120000 was claimed by another migration file.

ALTER TABLE public.p4_document_ingest_sessions
  ADD COLUMN IF NOT EXISTS content_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS story_fingerprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ingest_conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clarifying_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clarification_answers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.p4_document_ingest_sessions
  DROP CONSTRAINT IF EXISTS p4_document_ingest_sessions_status_check;

ALTER TABLE public.p4_document_ingest_sessions
  ADD CONSTRAINT p4_document_ingest_sessions_status_check
  CHECK (status IN ('scanning', 'authorship', 'clarification', 'review', 'committed', 'cancelled'));

NOTIFY pgrst, 'reload schema';
