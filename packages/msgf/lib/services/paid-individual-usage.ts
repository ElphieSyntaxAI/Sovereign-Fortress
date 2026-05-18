/**
 * PAID_INDIVIDUAL — monthly soft-cap metering (Postgres + Redis) and billing ledger debits.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import { MSGF_CREDIT_RESERVE_CHUNK } from "@/lib/credit-reservation";

/** Default monthly soft-cap for PAID_INDIVIDUAL platform CONVERGE (tokens). */
export const MSGF_PAID_INDIVIDUAL_MONTHLY_SOFT_CAP = Number(
  process.env.MSGF_PAID_INDIVIDUAL_MONTHLY_TOKEN_SOFT_CAP?.trim() || "1200"
);

/** Tokens debited per platform CONVERGE execution against the individual ledger. */
export const MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT =
  Number(process.env.MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT?.trim()) ||
  MSGF_CREDIT_RESERVE_CHUNK;

export type PaidIndividualMonthlyUsage = {
  billingPeriod: string;
  tokensConsumed: number;
  softCap: number;
  withinSoftCap: boolean;
  source: "redis" | "database" | "none";
};

export const PAID_INDIVIDUAL_QUOTA_EXCEEDED_WARNING =
  "Monthly token allowance exhausted for your PAID_INDIVIDUAL plan. Top up or upgrade to restore platform consensus, or add Gemini & Claude BYOK keys to continue on the free path." as const;

function currentBillingPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function secondsUntilUtcMonthEnd(): number {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(60, Math.floor((nextMonth.getTime() - now.getTime()) / 1000));
}

function paidIndividualRedisUsageKey(entityId: string, billingPeriod: string): string {
  return msgfRedisKey("paid-indiv", "tokens", entityId, billingPeriod);
}

function parseTokenCount(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function fetchMonthlyUsageFromDatabase(
  admin: SupabaseClient,
  entityId: string,
  billingPeriod: string
): Promise<number> {
  const { data, error } = await admin
    .from("msgf_paid_individual_monthly_usage")
    .select("tokens_consumed")
    .eq("entity_id", entityId)
    .eq("billing_period", billingPeriod)
    .maybeSingle();

  if (error) {
    console.warn("[paid-individual-usage] DB read failed:", error.message);
    return 0;
  }

  const raw = (data as { tokens_consumed?: string | number } | null)?.tokens_consumed ?? 0;
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Read monthly consumption for a PAID_INDIVIDUAL actor (Redis hot path, Postgres authoritative fallback).
 */
export async function evaluatePaidIndividualMonthlyUsage(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
}): Promise<PaidIndividualMonthlyUsage> {
  const entityId = params.entityId.trim();
  const billingPeriod = currentBillingPeriod();
  const softCap =
    Number.isFinite(MSGF_PAID_INDIVIDUAL_MONTHLY_SOFT_CAP) &&
    MSGF_PAID_INDIVIDUAL_MONTHLY_SOFT_CAP > 0
      ? Math.floor(MSGF_PAID_INDIVIDUAL_MONTHLY_SOFT_CAP)
      : 250_000;

  const redisKey = paidIndividualRedisUsageKey(entityId, billingPeriod);
  const redisRaw = await redisGet(redisKey);
  const redisTokens = parseTokenCount(redisRaw);
  const dbTokens = await fetchMonthlyUsageFromDatabase(
    params.adminSupabase,
    entityId,
    billingPeriod
  );

  const tokensConsumed = Math.max(redisTokens, dbTokens);
  const source: PaidIndividualMonthlyUsage["source"] =
    redisTokens > 0 ? "redis" : dbTokens > 0 ? "database" : "none";

  if (redisTokens < dbTokens) {
    await redisSet(redisKey, String(dbTokens), secondsUntilUtcMonthEnd());
  }

  return {
    billingPeriod,
    tokensConsumed,
    softCap,
    withinSoftCap: tokensConsumed < softCap,
    source,
  };
}

/**
 * Debit platform CONVERGE units to the individual billing ledger and roll monthly usage forward.
 */
export async function recordPaidIndividualPlatformConvergeCharge(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  idempotencyKey: string;
  tokens?: number;
  traceId?: string;
}): Promise<void> {
  const entityId = params.entityId.trim();
  const tenantId = params.tenantId.trim();
  const idempotencyKey = params.idempotencyKey.trim();
  if (!entityId || !tenantId) return;

  const tokens = Math.max(
    1,
    Math.floor(params.tokens ?? MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT)
  );
  const billingPeriod = currentBillingPeriod();

  const { error: ledgerError } = await params.adminSupabase
    .from("msgf_individual_billing_ledger")
    .insert({
      entity_id: entityId,
      tenant_id: tenantId,
      tokens,
      operation: "converge_debit",
      idempotency_key: idempotencyKey || null,
      metadata: {
        billing_period: billingPeriod,
        ...(params.traceId ? { trace_id: params.traceId } : {}),
      },
    });

  if (ledgerError) {
    if (ledgerError.code === "23505") {
      return;
    }
    console.warn("[paid-individual-usage] ledger insert failed:", ledgerError.message);
  }

  const { data: usageRow, error: usageReadError } = await params.adminSupabase
    .from("msgf_paid_individual_monthly_usage")
    .select("tokens_consumed")
    .eq("entity_id", entityId)
    .eq("billing_period", billingPeriod)
    .maybeSingle();

  if (usageReadError) {
    console.warn("[paid-individual-usage] usage read failed:", usageReadError.message);
    return;
  }

  const priorRaw = (usageRow as { tokens_consumed?: string | number } | null)?.tokens_consumed ?? 0;
  const prior =
    typeof priorRaw === "string" ? Number(priorRaw) : Number(priorRaw ?? 0);
  const nextConsumed = (Number.isFinite(prior) ? Math.floor(prior) : 0) + tokens;

  const { error: usageUpsertError } = await params.adminSupabase
    .from("msgf_paid_individual_monthly_usage")
    .upsert(
      {
        entity_id: entityId,
        billing_period: billingPeriod,
        tokens_consumed: nextConsumed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_id,billing_period" }
    );

  if (usageUpsertError) {
    console.warn("[paid-individual-usage] usage upsert failed:", usageUpsertError.message);
    return;
  }

  const redisKey = paidIndividualRedisUsageKey(entityId, billingPeriod);
  await redisSet(redisKey, String(nextConsumed), secondsUntilUtcMonthEnd());
}
