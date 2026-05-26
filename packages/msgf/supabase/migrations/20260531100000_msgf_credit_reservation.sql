-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
-- =============================================================================
-- =============================================================================
-- MSGF — tenant token wallet + credit_ledger reservations (402 insufficient funds).
-- Opt-in from app: MSGF_CREDIT_RESERVATION_ENABLED=true
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.msgf_tenant_token_wallet (
  tenant_id TEXT PRIMARY KEY,
  balance_tokens BIGINT NOT NULL DEFAULT 0 CHECK (balance_tokens >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.msgf_tenant_token_wallet IS
  'Per-tenant spendable token balance for MSGF credit reservation (402 when <= reserved amount).';

CREATE TABLE IF NOT EXISTS public.msgf_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.msgf_tenant_token_wallet (tenant_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  tokens_reserved BIGINT NOT NULL CHECK (tokens_reserved > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'committed', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.msgf_credit_ledger IS
  'Reserved token chunks per request; pending → committed (spent) or released (refund to wallet).';

CREATE UNIQUE INDEX IF NOT EXISTS msgf_credit_ledger_idempotent_pending
  ON public.msgf_credit_ledger (tenant_id, idempotency_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_msgf_credit_ledger_tenant_created
  ON public.msgf_credit_ledger (tenant_id, created_at DESC);

ALTER TABLE public.msgf_tenant_token_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_credit_ledger ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Release stale pending reservations (crash-safe refunds).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.msgf_credit_release_stale_pending(p_max_age_seconds INTEGER DEFAULT 900)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
BEGIN
  IF p_max_age_seconds IS NULL OR p_max_age_seconds < 60 THEN
    p_max_age_seconds := 900;
  END IF;

  WITH stale AS (
    SELECT id, tenant_id, tokens_reserved
    FROM public.msgf_credit_ledger
    WHERE status = 'pending'
      AND created_at < NOW() - (p_max_age_seconds::TEXT || ' seconds')::INTERVAL
    FOR UPDATE
  ),
  upd AS (
    UPDATE public.msgf_credit_ledger l
    SET status = 'released', updated_at = NOW()
    FROM stale s
    WHERE l.id = s.id AND l.status = 'pending'
    RETURNING l.tenant_id, l.tokens_reserved
  ),
  refund_totals AS (
    SELECT tenant_id, SUM(tokens_reserved)::BIGINT AS amt
    FROM upd
    GROUP BY tenant_id
  ),
  refund AS (
    UPDATE public.msgf_tenant_token_wallet w
    SET
      balance_tokens = w.balance_tokens + r.amt,
      updated_at = NOW()
    FROM refund_totals r
    WHERE w.tenant_id = r.tenant_id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO n FROM refund;

  RETURN COALESCE(n, 0);
END;
$$;

COMMENT ON FUNCTION public.msgf_credit_release_stale_pending IS
  'Marks stale pending ledger rows released and refunds tokens to msgf_tenant_token_wallet.';

-- -----------------------------------------------------------------------------
-- Reserve: idempotent on (tenant_id, idempotency_key) while pending or committed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.msgf_credit_reserve(
  p_tenant_id TEXT,
  p_idempotency_key TEXT,
  p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest RECORD;
  v_balance BIGINT;
  v_ledger_id UUID;
BEGIN
  IF p_tenant_id IS NULL OR length(trim(p_tenant_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_tenant');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_idempotency_key');
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  PERFORM public.msgf_credit_release_stale_pending(900);

  SELECT id, status INTO v_latest
  FROM public.msgf_credit_ledger
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_latest.status = 'committed' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_id', v_latest.id,
        'replay_committed', true
      );
    END IF;
    IF v_latest.status = 'pending' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'ledger_id', v_latest.id,
        'replay_pending', true
      );
    END IF;
  END IF;

  INSERT INTO public.msgf_tenant_token_wallet (tenant_id, balance_tokens)
  VALUES (p_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT balance_tokens INTO v_balance
  FROM public.msgf_tenant_token_wallet
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_missing');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'insufficient', true);
  END IF;

  UPDATE public.msgf_tenant_token_wallet
  SET
    balance_tokens = balance_tokens - p_amount,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  BEGIN
    INSERT INTO public.msgf_credit_ledger (tenant_id, idempotency_key, tokens_reserved, status)
    VALUES (p_tenant_id, p_idempotency_key, p_amount, 'pending')
    RETURNING id INTO v_ledger_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_ledger_id
      FROM public.msgf_credit_ledger
      WHERE tenant_id = p_tenant_id
        AND idempotency_key = p_idempotency_key
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_ledger_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'idempotency_race');
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'ledger_id', v_ledger_id,
        'replay_pending', true
      );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_id', v_ledger_id,
    'replay_pending', false,
    'replay_committed', false
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Finalize: commit (consume hold) or release (refund). Idempotent.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.msgf_credit_finalize(
  p_ledger_id UUID,
  p_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_mode TEXT := lower(trim(p_mode));
BEGIN
  IF p_ledger_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_ledger_id');
  END IF;
  IF v_mode NOT IN ('commit', 'release') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_mode');
  END IF;

  SELECT id, tenant_id, tokens_reserved, status
  INTO v_row
  FROM public.msgf_credit_ledger
  WHERE id = p_ledger_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ledger_not_found');
  END IF;

  IF v_row.status = 'committed' THEN
    RETURN jsonb_build_object('ok', true, 'already_finalized', true, 'status', 'committed');
  END IF;
  IF v_row.status = 'released' THEN
    RETURN jsonb_build_object('ok', true, 'already_finalized', true, 'status', 'released');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unexpected_status');
  END IF;

  IF v_mode = 'commit' THEN
    UPDATE public.msgf_credit_ledger
    SET status = 'committed', updated_at = NOW()
    WHERE id = p_ledger_id AND status = 'pending';
    RETURN jsonb_build_object('ok', true, 'status', 'committed');
  END IF;

  -- release → refund
  UPDATE public.msgf_credit_ledger
  SET status = 'released', updated_at = NOW()
  WHERE id = p_ledger_id AND status = 'pending';

  UPDATE public.msgf_tenant_token_wallet
  SET
    balance_tokens = balance_tokens + v_row.tokens_reserved,
    updated_at = NOW()
  WHERE tenant_id = v_row.tenant_id;

  RETURN jsonb_build_object('ok', true, 'status', 'released');
END;
$$;

GRANT EXECUTE ON FUNCTION public.msgf_credit_release_stale_pending(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.msgf_credit_reserve(TEXT, TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.msgf_credit_finalize(UUID, TEXT) TO service_role;
