-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
-- =============================================================================
-- INDIVIDUAL_PERPETUAL lifetime license — managed cloud window + purchase anchor.

ALTER TABLE public.p4_profiles
  ADD COLUMN IF NOT EXISTS license_type TEXT,
  ADD COLUMN IF NOT EXISTS license_purchase_date TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_profiles.license_type IS
  'Commercial license slug, e.g. INDIVIDUAL_PERPETUAL, CORPORATE, FREE.';

COMMENT ON COLUMN public.p4_profiles.license_purchase_date IS
  'UTC anchor for 1-year managed cloud consensus window (INDIVIDUAL_PERPETUAL).';

CREATE INDEX IF NOT EXISTS idx_p4_profiles_license_type
  ON public.p4_profiles (license_type)
  WHERE license_type IS NOT NULL;
