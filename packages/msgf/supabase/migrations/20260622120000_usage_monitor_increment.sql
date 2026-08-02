-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
-- =============================================================================
-- =============================================================================
-- usage_monitor atomic increment (service role only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.msgf_usage_monitor_add(
  p_user_id TEXT,
  p_delta BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;
  IF p_delta IS NULL OR p_delta < 0 THEN
    RAISE EXCEPTION 'p_delta must be non-negative';
  END IF;

  INSERT INTO public.usage_monitor (user_id, tokens_cumulative, updated_at)
  VALUES (trim(p_user_id), p_delta, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET
    tokens_cumulative = public.usage_monitor.tokens_cumulative + EXCLUDED.tokens_cumulative,
    updated_at = NOW()
  RETURNING tokens_cumulative INTO v_next;

  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION public.msgf_usage_monitor_add IS
  'Atomically add estimated tokens to usage_monitor for creditGuard alignment.';

REVOKE ALL ON FUNCTION public.msgf_usage_monitor_add(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.msgf_usage_monitor_add(TEXT, BIGINT) TO service_role;
