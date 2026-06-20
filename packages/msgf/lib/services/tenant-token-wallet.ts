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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * MSGF tenant token wallet (`msgf_tenant_token_wallet`) — used by credit reservation on Pulse/ingest.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_STARTER =
  Number.parseInt(process.env.MSGF_TENANT_WALLET_STARTER_TOKENS?.trim() ?? "", 10) || 100_000;

const DEFAULT_MIN_BEFORE_TOPUP =
  Number.parseInt(process.env.MSGF_TENANT_WALLET_MIN_BALANCE?.trim() ?? "", 10) || 5_000;

export async function readTenantWalletBalance(
  admin: SupabaseClient,
  tenantId: string
): Promise<number> {
  const tid = tenantId.trim();
  if (!tid) return 0;

  const { data, error } = await admin
    .from("msgf_tenant_token_wallet")
    .select("balance_tokens")
    .eq("tenant_id", tid)
    .maybeSingle();

  if (error) {
    console.warn("[tenant-token-wallet] read failed:", error.message);
    return 0;
  }

  return Number(data?.balance_tokens ?? 0);
}

/**
 * Ensures the tenant wallet exists with at least `minBalance` tokens (tops up to starter default).
 */
export async function ensureTenantWalletStarter(
  admin: SupabaseClient,
  tenantId: string,
  options?: { minBalance?: number; starterAmount?: number }
): Promise<{ tenantId: string; previous: number; next: number; toppedUp: boolean }> {
  const tid = tenantId.trim();
  if (!tid) {
    throw new Error("ensureTenantWalletStarter: tenantId is required");
  }

  const minBalance = options?.minBalance ?? DEFAULT_MIN_BEFORE_TOPUP;
  const starterAmount = options?.starterAmount ?? DEFAULT_STARTER;

  const previous = await readTenantWalletBalance(admin, tid);
  if (previous >= minBalance) {
    return { tenantId: tid, previous, next: previous, toppedUp: false };
  }

  const next = Math.max(starterAmount, previous);
  const { error } = await admin.from("msgf_tenant_token_wallet").upsert(
    {
      tenant_id: tid,
      balance_tokens: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );

  if (error) {
    throw new Error(`ensureTenantWalletStarter: ${error.message}`);
  }

  return { tenantId: tid, previous, next, toppedUp: true };
}
