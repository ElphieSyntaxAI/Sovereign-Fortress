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
-- =============================================================================
-- I5: Webhook idempotency inbox + envelope archive status (signing / Dropbox).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_webhook_inbox (
  idempotency_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  invite_id UUID,
  external_request_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT,
  CONSTRAINT msgf_webhook_inbox_provider_check CHECK (
    provider IN ('docusign', 'dropbox_sign', 'sentry', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_msgf_webhook_inbox_received
  ON public.msgf_webhook_inbox (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgf_webhook_inbox_unprocessed
  ON public.msgf_webhook_inbox (received_at ASC)
  WHERE processed_at IS NULL;

COMMENT ON TABLE public.msgf_webhook_inbox IS
  'Idempotent webhook intake. ON CONFLICT DO NOTHING — duplicates skip re-complete.';

ALTER TABLE public.msgf_webhook_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msgf_webhook_inbox_service_role_all ON public.msgf_webhook_inbox;
CREATE POLICY msgf_webhook_inbox_service_role_all
  ON public.msgf_webhook_inbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_webhook_inbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.msgf_webhook_inbox TO service_role;

ALTER TABLE public.msgf_docusign_envelopes
  ADD COLUMN IF NOT EXISTS archive_status TEXT
    CHECK (
      archive_status IS NULL
      OR archive_status IN ('pending_local', 'queued', 'archived', 'failed')
    );

COMMENT ON COLUMN public.msgf_docusign_envelopes.archive_status IS
  'I5 Dropbox archive: pending_local when Redis down; queued/archived/failed after worker.';
