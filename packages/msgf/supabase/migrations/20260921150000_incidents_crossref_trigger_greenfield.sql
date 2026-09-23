-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
-- =============================================================================
-- Greenfield repair: 20260523120000 skipped incidents CROSS-REF trigger when
-- public.msgf_incidents did not exist yet (table lands in 20260528120000).

DO $$
BEGIN
  IF to_regclass('public.msgf_incidents') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.msgf_incidents_bug_index_enforce') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'DROP TRIGGER IF EXISTS trg_msgf_incidents_bug_index_enforce ON public.msgf_incidents';
  EXECUTE $trg$
    CREATE TRIGGER trg_msgf_incidents_bug_index_enforce
      BEFORE INSERT OR UPDATE OF bug_index
      ON public.msgf_incidents
      FOR EACH ROW
      EXECUTE FUNCTION public.msgf_incidents_bug_index_enforce()
  $trg$;
END $$;
