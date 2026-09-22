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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * INDIVIDUAL_PERPETUAL — monthly verification-slice metering (Postgres + Redis) and ledger debits.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import { MSGF_CREDIT_RESERVE_CHUNK } from "@/lib/credit-reservation";

/** Default monthly soft-cap: consensus verification slices (not LLM tokens). */
export const MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP = Number(
  process.env.MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP?.trim() ||
    process.env.MSGF_PAID_INDIVIDUAL_MONTHLY_TOKEN_SOFT_CAP?.trim() ||
    "1200"
);

/** 3-day Individual Pro trial — keep Pro routing, cap cloud CONVERGE slices. */
export const MSGF_TRIAL_3D_SLICE_SOFT_CAP = Number(
  process.env.MSGF_TRIAL_3D_SLICE_SOFT_CAP?.trim() || "200"
);

/** @deprecated Use {@link MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP}. */
export const MSGF_PAID_INDIVIDUAL_MONTHLY_SOFT_CAP = MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP;

/** Tokens debited per platform CONVERGE execution against the individual ledger. */
export const MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT =
  Number(process.env.MSGF_PAID_INDIVIDUAL_CONVERGE_DEBIT?.trim()) ||
  MSGF_CREDIT_RESERVE_CHUNK;

export type PerpetualMonthlySliceUsage = {
  billingPeriod: string;
  slicesConsumed: number;
  softCap: number;
  withinSoftCap: boolean;
  source: "redis" | "database" | "none";
};

/** @deprecated Use {@link PerpetualMonthlySliceUsage}. */
export type PaidIndividualMonthlyUsage = PerpetualMonthlySliceUsage & {
  tokensConsumed: number;
};

export const PERPETUAL_SOFT_CAP_EXCEEDED_MESSAGE =
  "Monthly verification slice allowance (1,200) exceeded. Use personal BYOK keys in your IDE or workspace for dual-model consensus, or continue with single-model validation." as const;

export const MANAGED_CLOUD_EXPIRED_BYPASS_WARNING =
  "Managed cloud window expired. Please add your personal Gemini & Claude keys to continue running dual-model consensus." as const;

/** @deprecated */
export const PAID_INDIVIDUAL_QUOTA_EXCEEDED_WARNING = PERPETUAL_SOFT_CAP_EXCEEDED_MESSAGE;

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
export async function evaluatePerpetualMonthlySliceUsage(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  softCapOverride?: number;
}): Promise<PerpetualMonthlySliceUsage> {
  const entityId = params.entityId.trim();
  const billingPeriod = currentBillingPeriod();
  const override = params.softCapOverride;
  const softCap =
    typeof override === "number" && Number.isFinite(override) && override > 0
      ? Math.floor(override)
      : Number.isFinite(MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP) &&
          MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP > 0
        ? Math.floor(MSGF_PERPETUAL_MONTHLY_SLICE_SOFT_CAP)
        : 1200;

  const redisKey = paidIndividualRedisUsageKey(entityId, billingPeriod);
  const redisRaw = await redisGet(redisKey);
  const redisSlices = parseTokenCount(redisRaw);
  const dbSlices = await fetchMonthlyUsageFromDatabase(
    params.adminSupabase,
    entityId,
    billingPeriod
  );

  const slicesConsumed = Math.max(redisSlices, dbSlices);
  const source: PerpetualMonthlySliceUsage["source"] =
    redisSlices > 0 ? "redis" : dbSlices > 0 ? "database" : "none";

  if (redisSlices < dbSlices) {
    await redisSet(redisKey, String(dbSlices), secondsUntilUtcMonthEnd());
  }

  return {
    billingPeriod,
    slicesConsumed,
    softCap,
    withinSoftCap: slicesConsumed < softCap,
    source,
  };
}

/** @deprecated Use {@link evaluatePerpetualMonthlySliceUsage}. */
export async function evaluatePaidIndividualMonthlyUsage(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
}): Promise<PaidIndividualMonthlyUsage> {
  const u = await evaluatePerpetualMonthlySliceUsage(params);
  return { ...u, tokensConsumed: u.slicesConsumed };
}

/**
 * Debit platform CONVERGE units to the individual billing ledger and roll monthly usage forward.
 */
export async function recordPerpetualPlatformConvergeSlice(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  idempotencyKey: string;
  slices?: number;
  traceId?: string;
}): Promise<void> {
  return recordPaidIndividualPlatformConvergeCharge({
    ...params,
    tokens: params.slices,
  });
}

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
