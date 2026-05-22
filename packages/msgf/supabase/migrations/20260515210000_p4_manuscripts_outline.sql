-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
-- =============================================================================
-- Optional high-level outline text on manuscript (Planning dashboard).

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS outline TEXT;

COMMENT ON COLUMN public.p4_manuscripts.outline IS
  'Author-maintained outline / beat sheet text for Planning mode (distinct from ingested plot chunks).';
