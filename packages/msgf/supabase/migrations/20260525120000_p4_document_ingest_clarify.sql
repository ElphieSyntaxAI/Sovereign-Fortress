-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
-- =============================================================================
-- Context-aware ingest: structure signals, story fingerprint, conflicts, clarifying Q&A.

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

COMMENT ON COLUMN public.p4_document_ingest_sessions.content_signals IS
  'Detected shapes in upload (scene cards, chapter breakdown, character cards, notes, etc.).';
COMMENT ON COLUMN public.p4_document_ingest_sessions.story_fingerprint IS
  'Extracted title, cast, setting anchors for cross-check with manuscript / prior imports.';
COMMENT ON COLUMN public.p4_document_ingest_sessions.ingest_conflicts IS
  'Blocking or warning conflicts (multiple WIPs, disjoint casts, contradicts saved outline).';
COMMENT ON COLUMN public.p4_document_ingest_sessions.clarifying_questions IS
  'Author must answer before merge when conflicts are ambiguous.';
COMMENT ON COLUMN public.p4_document_ingest_sessions.clarification_answers IS
  'Stored answers from POST verify-clarification.';
