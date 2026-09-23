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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Persist Shadow Proxy evaluation rows (projected savings — never proven eco).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import { incrPeriodField } from "@/lib/services/period-counters";
import type { ShadowEvaluationLog } from "@/lib/gateway/types";

const WINDOW_SEC = 86_400;

async function readCounter(key: string): Promise<number> {
  const raw = await redisGet(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function addFloat(key: string, delta: number): Promise<void> {
  if (!(delta > 0)) return;
  const prior = await readCounter(key);
  await redisSet(key, String(prior + delta), WINDOW_SEC);
}

export async function writeShadowEvaluationLog(
  admin: SupabaseClient | null,
  log: ShadowEvaluationLog
): Promise<void> {
  const tid = log.tenantId.trim();
  if (!tid) return;

  // Redis 24h rollups for dashboard (projected USD only).
  await Promise.all([
    addFloat(msgfRedisKey("shadow-eval", tid, "projected_usd"), log.savingsPotentialUSD),
    addFloat(msgfRedisKey("shadow-eval", tid, "actual_usd"), log.actualCostUSD),
    addFloat(
      msgfRedisKey("shadow-eval", tid, "count"),
      1
    ),
  ]);

  // Ops-only estimated tokens for period reports (not proven eco).
  if (log.savingsPotentialUSD > 0 && log.actualTokens > log.projectedTokens) {
    void incrPeriodField(tid, "estimated_saved", log.actualTokens - log.projectedTokens);
  }
  if (log.savingsPotentialUSD > 0) {
    void incrPeriodField(
      tid,
      "shadow_projected_usd_cents",
      Math.max(1, Math.round(log.savingsPotentialUSD * 100))
    );
  }

  if (!admin) return;

  try {
    const { error } = await admin.from("msgf_shadow_evaluation_logs").insert({
      tenant_id: tid,
      endpoint: log.endpoint,
      provider: log.provider,
      mode: log.mode,
      stream: log.stream,
      prompt_hash: log.promptHash,
      actual_tokens: log.actualTokens,
      actual_cost_usd: log.actualCostUSD,
      projected_tokens: log.projectedTokens,
      projected_cost_usd: log.projectedCostUSD,
      savings_potential_usd: log.savingsPotentialUSD,
      recommended_action: log.recommendedAction,
      usage_source: log.usageSource,
      model: log.model,
      observed_at: new Date(log.timestamp).toISOString(),
      p7_promote_count: log.p7PromoteCount ?? 0,
      p7_block_count: log.p7BlockCount ?? 0,
      p7_deferred: log.p7Deferred ?? null,
    });
    if (error) {
      console.warn("[shadow-ledger] insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[shadow-ledger] insert error:", e);
  }
}

export type ShadowEvalSummary24h = {
  tenant_id: string;
  window_hours: 24;
  evaluation_count: number;
  actual_cost_usd: number;
  projected_savings_usd: number;
};

export async function getShadowEvalSummary24h(
  tenantId: string
): Promise<ShadowEvalSummary24h> {
  const tid = tenantId.trim();
  const [evaluation_count, actual_cost_usd, projected_savings_usd] = await Promise.all([
    readCounter(msgfRedisKey("shadow-eval", tid, "count")),
    readCounter(msgfRedisKey("shadow-eval", tid, "actual_usd")),
    readCounter(msgfRedisKey("shadow-eval", tid, "projected_usd")),
  ]);
  return {
    tenant_id: tid,
    window_hours: 24,
    evaluation_count: Math.floor(evaluation_count),
    actual_cost_usd: Math.round(actual_cost_usd * 1_000_000) / 1_000_000,
    projected_savings_usd: Math.round(projected_savings_usd * 1_000_000) / 1_000_000,
  };
}

export async function listRecentShadowEvaluations(
  admin: SupabaseClient,
  tenantId: string,
  limit = 20
): Promise<Record<string, unknown>[]> {
  const { data, error } = await admin
    .from("msgf_shadow_evaluation_logs")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .order("observed_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) {
    console.warn("[shadow-ledger] list failed:", error.message);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}

export async function listShadowEvaluationsForProof(
  admin: SupabaseClient,
  tenantId: string,
  sinceIso?: string,
  limit = 2000
): Promise<Record<string, unknown>[]> {
  let query = admin
    .from("msgf_shadow_evaluation_logs")
    .select(
      "prompt_hash, actual_cost_usd, recommended_action, actual_tokens, observed_at, p7_promote_count, p7_block_count, p7_deferred"
    )
    .eq("tenant_id", tenantId.trim())
    .order("observed_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 5000));
  if (sinceIso?.trim()) {
    query = query.gte("observed_at", sinceIso.trim());
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[shadow-ledger] proof list failed:", error.message);
    return [];
  }
  return (data ?? []) as Record<string, unknown>[];
}
