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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Proven avoidance ledger — only tokens we can defend in public eco claims.
 *
 * Rules:
 * - Eco rollups accept `proven_avoidance` only (default), never raw estimates.
 * - Avoidance amount = metered rolling CONVERGE baseline − local path cost
 *   (or an audited pack delta for verify/Run Scripts).
 * - If no metered baseline exists yet, record estimate counters for ops only;
 *   do NOT inflate public Sustainable Compute totals.
 */

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import {
  ecoAggregatorClient,
  isEcoProvenOnlyEnabled,
} from "@/lib/services/EcoAggregatorClient";
import {
  getRollingConvergeBaselineTokens,
  type ProviderMeterContext,
} from "@/lib/services/provider-usage-meter";
import { incrPeriodField } from "@/lib/services/period-counters";
import { MSGF_LOCAL_GATEWAY_BASE_TOKENS } from "@/lib/services/token-usage-estimate";
import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";

const WINDOW_SEC = 86_400;

export type EcoEvidenceKind =
  | "proven_avoidance"
  | "metered_provider"
  | "estimated_model"
  | "pack_delta";

export type ProvenAvoidanceReason =
  | "local_gateway"
  | "converge_bypass"
  | "converge_cache_hit"
  | "pulse_idempotency"
  | "ingest_hash_skip"
  | "verify_vault_pack"
  | "run_script_rerun"
  | "confirm_pack"
  | "gateway_cache_hit"
  | "gateway_semantic_cache_hit"
  | "gateway_state_gate"
  | "gateway_small_brain"
  | "other";

export type ProvenAvoidanceRecord = {
  tenant_id: string;
  reason: ProvenAvoidanceReason;
  tokens_avoided: number;
  baseline_tokens: number;
  local_tokens: number;
  evidence: EcoEvidenceKind;
  baseline_source: "rolling_metered_median" | "pack_char_delta" | "none";
  sample_count: number;
  /** Optional gateway audit fields (durable PG). */
  provider?: string;
  endpoint?: string;
  prompt_hash?: string;
  routing_strategy?: string;
  saved_cost_usd?: number;
};

export type ProvenSavingsSummary24h = {
  tenant_id: string;
  window_hours: 24;
  proven_tokens_saved: number;
  estimated_tokens_saved: number;
  eco_metrics_proven: EcoMetrics;
  eco_claim_allowed: boolean;
  disclaimer: string;
};

export { isEcoProvenOnlyEnabled };

async function readCounter(key: string): Promise<number> {
  const raw = await redisGet(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function addToCounter(key: string, delta: number): Promise<void> {
  const d = Math.floor(delta);
  if (d <= 0) return;
  const prior = await readCounter(key);
  await redisSet(key, String(prior + d), WINDOW_SEC);
}

export const PROVEN_ECO_DISCLAIMER =
  "Environmental impact is derived only from proven avoided provider tokens " +
  "(metered CONVERGE baseline × avoided calls, or audited pack character deltas). " +
  "Factors (kWh / CO₂e / water per million tokens) are published model coefficients, not utility bills. " +
  "Estimated routing models are shown separately and never inflate public eco totals when MSGF_ECO_PROVEN_ONLY=1.";

/**
 * Compute tokens avoided using metered baseline. Returns null when not yet proveable.
 */
export async function computeProvenPulseAvoidance(params: {
  tenantId: string;
  routing: string;
  contentChars?: number;
}): Promise<ProvenAvoidanceRecord | null> {
  const tid = params.tenantId.trim();
  if (!tid) return null;

  const kind = params.routing.trim().toLowerCase();
  const isCheap =
    kind === "local_gateway" ||
    kind === "converge_bypass" ||
    kind.includes("degraded");
  if (!isCheap) return null;

  const baseline = await getRollingConvergeBaselineTokens(tid, 2);
  if (!baseline || baseline.tokens <= 0 || baseline.sample_count < 2) {
    return null;
  }

  const contextTokens = Math.max(0, Math.floor((params.contentChars ?? 0) / 4));
  const local_tokens = MSGF_LOCAL_GATEWAY_BASE_TOKENS + contextTokens;
  const tokens_avoided = Math.max(0, baseline.tokens - local_tokens);
  if (tokens_avoided <= 0) return null;

  return {
    tenant_id: tid,
    reason: kind === "converge_bypass" ? "converge_bypass" : "local_gateway",
    tokens_avoided,
    baseline_tokens: baseline.tokens,
    local_tokens,
    evidence: "proven_avoidance",
    baseline_source: "rolling_metered_median",
    sample_count: baseline.sample_count,
  };
}

export async function recordProvenAvoidance(
  record: ProvenAvoidanceRecord,
  context?: {
    userId?: string;
    projectOrigin?: string;
    admin?: import("@supabase/supabase-js").SupabaseClient | null;
  }
): Promise<void> {
  const tid = record.tenant_id.trim();
  if (!tid || record.tokens_avoided <= 0) return;

  await addToCounter(
    msgfRedisKey("proven-savings", tid, "tokens"),
    record.tokens_avoided
  );
  await addToCounter(
    msgfRedisKey("proven-savings", tid, "events", record.reason),
    1
  );
  void incrPeriodField(tid, "proven_saved", record.tokens_avoided);

  if (record.evidence === "proven_avoidance" || record.evidence === "pack_delta") {
    void ecoAggregatorClient.sendProvenEcoTelemetry(
      tid,
      record.tokens_avoided,
      {
        userId: context?.userId,
        projectOrigin: context?.projectOrigin,
        evidence: record.evidence,
        reason: record.reason,
      }
    );
  }

  // Durable Postgres best-effort (Redis remains hot path).
  if (context?.admin) {
    void context.admin
      .from("msgf_proven_avoidance_events")
      .insert({
        tenant_id: tid,
        reason: record.reason,
        tokens_avoided: record.tokens_avoided,
        baseline_tokens: record.baseline_tokens,
        local_tokens: record.local_tokens,
        evidence: record.evidence,
        baseline_source: record.baseline_source,
        sample_count: record.sample_count,
        provider: record.provider ?? null,
        endpoint: record.endpoint ?? null,
        prompt_hash: record.prompt_hash ?? null,
        routing_strategy: record.routing_strategy ?? record.reason,
        saved_cost_usd: record.saved_cost_usd ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.warn(
            "[proven-savings] PG insert failed:",
            error.message
          );
        }
      });
  }
}

/** Ops-only estimated counter — never feeds public eco when proven-only is on. */
export async function recordEstimatedSavingsTokens(
  tenantId: string,
  tokens: number
): Promise<void> {
  const tid = tenantId.trim();
  const d = Math.floor(tokens);
  if (!tid || d <= 0) return;
  await addToCounter(msgfRedisKey("proven-savings", tid, "estimated_tokens"), d);
  void incrPeriodField(tid, "estimated_saved", d);
}

export async function getProvenSavingsSummary24h(
  tenantId: string
): Promise<ProvenSavingsSummary24h> {
  const tid = tenantId.trim();
  const [proven_tokens_saved, estimated_tokens_saved] = await Promise.all([
    readCounter(msgfRedisKey("proven-savings", tid, "tokens")),
    readCounter(msgfRedisKey("proven-savings", tid, "estimated_tokens")),
  ]);
  const eco_metrics_proven = calculateEcoSavings(proven_tokens_saved);
  return {
    tenant_id: tid,
    window_hours: 24,
    proven_tokens_saved,
    estimated_tokens_saved,
    eco_metrics_proven,
    eco_claim_allowed: proven_tokens_saved > 0,
    disclaimer: PROVEN_ECO_DISCLAIMER,
  };
}

/** Pack char deltas are audited (verify/Run Scripts) — treat as pack_delta evidence. */
export async function recordPackDeltaProvenSavings(params: {
  tenantId: string;
  reason: "verify_vault_pack" | "run_script_rerun" | "confirm_pack";
  tokensSaved: number;
  userId?: string;
  projectOrigin?: string;
}): Promise<void> {
  const tokens = Math.floor(params.tokensSaved);
  if (tokens <= 0) return;
  await recordProvenAvoidance(
    {
      tenant_id: params.tenantId,
      reason: params.reason,
      tokens_avoided: tokens,
      baseline_tokens: tokens,
      local_tokens: 0,
      evidence: "pack_delta",
      baseline_source: "pack_char_delta",
      sample_count: 1,
    },
    { userId: params.userId, projectOrigin: params.projectOrigin }
  );
}

export type MeterPurpose = ProviderMeterContext["purpose"];
