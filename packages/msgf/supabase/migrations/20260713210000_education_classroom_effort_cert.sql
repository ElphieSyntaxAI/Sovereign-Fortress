-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
-- =============================================================================
-- Classroom-first Human Effort Certificate stub (pre-Canvas AGS).
-- Allows null privacy_vault_id and ags_status = classroom_stub.

ALTER TABLE public.education_human_effort_certificates
  ALTER COLUMN privacy_vault_id DROP NOT NULL;

ALTER TABLE public.education_human_effort_certificates
  DROP CONSTRAINT IF EXISTS education_human_effort_certificates_ags_status_check;

ALTER TABLE public.education_human_effort_certificates
  ADD CONSTRAINT education_human_effort_certificates_ags_status_check
  CHECK (ags_status IN ('pending', 'submitted', 'failed', 'classroom_stub', 'local_only'));

COMMENT ON COLUMN public.education_human_effort_certificates.ags_status IS
  'pending|submitted|failed = Canvas AGS; classroom_stub = Google Classroom grade placeholder; local_only = digests without LMS passback.';
