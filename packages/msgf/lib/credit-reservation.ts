/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimum reserved chunk before Pulse / ingest LLM work (see msgf_credit_reserve). */
export const MSGF_CREDIT_RESERVE_CHUNK = 1000;

export type CreditReservationStart =
  | { enabled: false }
  | { enabled: true; insufficient: true }
  | { enabled: true; insufficient: false; ledgerId: string };

export function isCreditReservationEnabled(): boolean {
  const v = process.env.MSGF_CREDIT_RESERVATION_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** True when ingest will run embeddings (sweep) and/or Gemini audit — reserve before that work. */
export function shouldReserveForIngestWithFiles(fileCount: number): boolean {
  return isCreditReservationEnabled() && fileCount > 0;
}

/**
 * Atomically reserves tokens via `msgf_credit_reserve` (idempotent per tenant + idempotency key).
 */
export async function startTenantCreditReservation(
  admin: SupabaseClient,
  tenantId: string,
  idempotencyKey: string,
  amount: number = MSGF_CREDIT_RESERVE_CHUNK
): Promise<CreditReservationStart> {
  if (!isCreditReservationEnabled()) return { enabled: false };

  const tid = tenantId.trim();
  const key = idempotencyKey.trim();
  if (!tid || !key) {
    throw new Error("startTenantCreditReservation: tenantId and idempotencyKey are required.");
  }

  const { data, error } = await admin.rpc("msgf_credit_reserve", {
    p_tenant_id: tid,
    p_idempotency_key: key,
    p_amount: amount,
  });

  if (error) {
    console.error("[credit-reservation] msgf_credit_reserve RPC failed:", error.message);
    throw error;
  }

  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    if (row?.insufficient === true) {
      return { enabled: true, insufficient: true };
    }
    throw new Error(`msgf_credit_reserve: ${String(row?.error ?? "unknown_error")}`);
  }

  const ledgerId =
    typeof row.ledger_id === "string"
      ? row.ledger_id
      : row.ledger_id != null
        ? String(row.ledger_id)
        : "";

  if (!ledgerId) {
    throw new Error("msgf_credit_reserve: missing ledger_id");
  }

  return { enabled: true, insufficient: false, ledgerId };
}

/**
 * Commit reserved tokens (success path) or release back to wallet (failure / non-2xx / 3xx).
 * Safe when ledger is already committed/released (RPC is idempotent).
 */
export async function endTenantCreditReservation(
  admin: SupabaseClient,
  start: CreditReservationStart,
  httpStatus: number
): Promise<void> {
  if (!start.enabled || start.insufficient) return;

  const mode = httpStatus >= 200 && httpStatus < 400 ? "commit" : "release";
  const { data, error } = await admin.rpc("msgf_credit_finalize", {
    p_ledger_id: start.ledgerId,
    p_mode: mode,
  });

  if (error) {
    console.error("[credit-reservation] msgf_credit_finalize RPC failed:", error.message);
    throw error;
  }

  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    console.error("[credit-reservation] msgf_credit_finalize unexpected payload:", data);
    throw new Error(`msgf_credit_finalize: ${String(row?.error ?? "unknown_error")}`);
  }
}

/** Cron-friendly: refunds pending reservations older than `maxAgeSeconds` (default 15m). */
export async function releaseStaleCreditReservations(
  admin: SupabaseClient,
  maxAgeSeconds: number = 900
): Promise<number> {
  const { data, error } = await admin.rpc("msgf_credit_release_stale_pending", {
    p_max_age_seconds: maxAgeSeconds,
  });

  if (error) {
    console.error("[credit-reservation] msgf_credit_release_stale_pending failed:", error.message);
    throw error;
  }

  const n = typeof data === "number" ? data : Number(data ?? 0);
  return Number.isFinite(n) ? n : 0;
}
