-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
-- =============================================================================
-- Multiple Google Docs per manuscript (outlines, chapters, bible) for HAL + link session.

ALTER TABLE public.p4_manuscript_link_sessions
  ADD COLUMN IF NOT EXISTS reported_docs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.p4_manuscript_link_sessions.reported_docs IS
  'All docs reported during link session: [{ google_doc_id, google_doc_url, google_doc_title }].';

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS companion_google_docs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.p4_manuscripts.companion_google_docs IS
  'Additional Google Docs for the same book (chapters, outline, bible) besides google_doc_id primary.';

NOTIFY pgrst, 'reload schema';
