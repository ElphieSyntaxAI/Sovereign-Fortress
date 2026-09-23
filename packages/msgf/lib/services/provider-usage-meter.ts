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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Layer-1 provider usage metering — persist real response.usage from MSGF-owned
 * Claude / Gemini / xAI calls. Used as spend truth + rolling CONVERGE baseline
 * for proven avoidance (eco claims must not invent baselines).
 */

import { msgfRedisKey, redisGet, redisIncrWithWindow, redisSet } from "@/lib/redis";
import { incrPeriodField } from "@/lib/services/period-counters";

const WINDOW_SEC = 86_400;
const BASELINE_SAMPLES_MAX = 48;

export type MsgfProviderId = "anthropic" | "google" | "xai" | "openai" | "unknown";

export type ProviderUsageSample = {
  provider: MsgfProviderId;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  total_tokens: number;
};

export type ProviderMeterContext = {
  tenantId: string;
  purpose:
    | "dual_model"
    | "tri_vote"
    | "global_converge"
    | "sovereign_auditor"
    | "dev_event"
    | "other";
  requestId?: string;
  endpoint?: string;
  promptHash?: string;
  admin?: import("@supabase/supabase-js").SupabaseClient | null;
};

export type TenantMeteredUsageSummary24h = {
  tenant_id: string;
  window_hours: 24;
  call_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  by_provider: Partial<Record<MsgfProviderId, number>>;
  rolling_converge_baseline_tokens: number | null;
  baseline_sample_count: number;
  provenance: "metered_provider";
};

function floorNonNeg(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function parseAnthropicUsage(
  usage: unknown,
  model: string
): ProviderUsageSample | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const input = floorNonNeg(u.input_tokens);
  const output = floorNonNeg(u.output_tokens);
  const cacheRead = floorNonNeg(u.cache_read_input_tokens);
  const cacheWrite =
    floorNonNeg(u.cache_creation_input_tokens) ||
    floorNonNeg(
      (u.cache_creation as { ephemeral_5m_input_tokens?: number } | undefined)
        ?.ephemeral_5m_input_tokens
    );
  const total = input + output + cacheRead + cacheWrite;
  if (total <= 0) return null;
  return {
    provider: "anthropic",
    model: model.trim() || "anthropic",
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cacheRead || undefined,
    cache_write_tokens: cacheWrite || undefined,
    total_tokens: total,
  };
}

export function parseOpenAiStyleUsage(
  usage: unknown,
  model: string,
  provider: MsgfProviderId = "openai"
): ProviderUsageSample | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const input = floorNonNeg(u.prompt_tokens ?? u.input_tokens);
  const output = floorNonNeg(u.completion_tokens ?? u.output_tokens);
  const total = floorNonNeg(u.total_tokens) || input + output;
  if (total <= 0) return null;
  return {
    provider,
    model: model.trim() || provider,
    input_tokens: input,
    output_tokens: output,
    total_tokens: total,
  };
}

export function parseGeminiUsage(
  usageMetadata: unknown,
  model: string
): ProviderUsageSample | null {
  if (!usageMetadata || typeof usageMetadata !== "object") return null;
  const u = usageMetadata as Record<string, unknown>;
  const input = floorNonNeg(u.promptTokenCount ?? u.prompt_token_count);
  const output = floorNonNeg(u.candidatesTokenCount ?? u.candidates_token_count);
  const total =
    floorNonNeg(u.totalTokenCount ?? u.total_token_count) || input + output;
  if (total <= 0) return null;
  return {
    provider: "google",
    model: model.trim() || "gemini",
    input_tokens: input,
    output_tokens: output,
    total_tokens: total,
  };
}

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

function isConvergePurpose(purpose: ProviderMeterContext["purpose"]): boolean {
  return (
    purpose === "global_converge" ||
    purpose === "dual_model" ||
    purpose === "tri_vote" ||
    purpose === "sovereign_auditor"
  );
}

/**
 * Persist a single provider response.usage sample (fire-and-forget safe).
 */
export async function recordMeteredProviderUsage(
  ctx: ProviderMeterContext,
  sample: ProviderUsageSample
): Promise<void> {
  const tid = ctx.tenantId.trim();
  if (!tid || sample.total_tokens <= 0) return;

  const base = (...parts: string[]) => msgfRedisKey("provider-usage", tid, ...parts);

  await Promise.all([
    redisIncrWithWindow(base("calls"), WINDOW_SEC),
    addToCounter(base("input_tokens"), sample.input_tokens),
    addToCounter(base("output_tokens"), sample.output_tokens),
    addToCounter(base("total_tokens"), sample.total_tokens),
    addToCounter(base("by", sample.provider), sample.total_tokens),
    incrPeriodField(tid, "metered_consumed", sample.total_tokens),
    incrPeriodField(tid, "provider_calls", 1),
  ]);

  if (isConvergePurpose(ctx.purpose)) {
    await pushBaselineSample(tid, sample.total_tokens);
  }

  if (ctx.admin) {
    void ctx.admin
      .from("msgf_provider_usage_events")
      .insert({
        tenant_id: tid,
        provider: sample.provider,
        model: sample.model,
        purpose: ctx.purpose,
        input_tokens: sample.input_tokens,
        output_tokens: sample.output_tokens,
        total_tokens: sample.total_tokens,
        request_id: ctx.requestId ?? null,
        endpoint: ctx.endpoint ?? null,
        prompt_hash: ctx.promptHash ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("[provider-usage-meter] PG insert failed:", error.message);
        }
      });
  }
}

async function pushBaselineSample(tenantId: string, tokens: number): Promise<void> {
  const key = msgfRedisKey("provider-usage", tenantId, "baseline_samples");
  const raw = await redisGet(key);
  let samples: number[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      samples = parsed
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.floor(n));
    }
  } catch {
    samples = [];
  }
  samples.push(Math.floor(tokens));
  if (samples.length > BASELINE_SAMPLES_MAX) {
    samples = samples.slice(samples.length - BASELINE_SAMPLES_MAX);
  }
  await redisSet(key, JSON.stringify(samples), WINDOW_SEC * 7);
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.floor(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? null;
}

/**
 * Rolling median of recent metered CONVERGE/dual/TRI call totals for this tenant.
 * Returns null until enough real samples exist — callers must not invent a baseline.
 */
export async function getRollingConvergeBaselineTokens(
  tenantId: string,
  minSamples = 2
): Promise<{ tokens: number; sample_count: number } | null> {
  const tid = tenantId.trim();
  if (!tid) return null;
  const key = msgfRedisKey("provider-usage", tid, "baseline_samples");
  const raw = await redisGet(key);
  let samples: number[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      samples = parsed
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.floor(n));
    }
  } catch {
    samples = [];
  }
  if (samples.length < minSamples) {
    return { tokens: 0, sample_count: samples.length };
  }
  const tokens = median(samples);
  if (tokens == null || tokens <= 0) return { tokens: 0, sample_count: samples.length };
  return { tokens, sample_count: samples.length };
}

export async function getTenantMeteredUsageSummary24h(
  tenantId: string
): Promise<TenantMeteredUsageSummary24h> {
  const tid = tenantId.trim();
  const base = (...parts: string[]) => msgfRedisKey("provider-usage", tid, ...parts);
  const [
    call_count,
    input_tokens,
    output_tokens,
    total_tokens,
    anthropic,
    google,
    xai,
    openai,
    baseline,
  ] = await Promise.all([
    readCounter(base("calls")),
    readCounter(base("input_tokens")),
    readCounter(base("output_tokens")),
    readCounter(base("total_tokens")),
    readCounter(base("by", "anthropic")),
    readCounter(base("by", "google")),
    readCounter(base("by", "xai")),
    readCounter(base("by", "openai")),
    getRollingConvergeBaselineTokens(tid, 1),
  ]);

  const ready =
    baseline && baseline.sample_count >= 2 && baseline.tokens > 0
      ? baseline.tokens
      : null;

  return {
    tenant_id: tid,
    window_hours: 24,
    call_count,
    input_tokens,
    output_tokens,
    total_tokens,
    by_provider: {
      anthropic,
      google,
      xai,
      openai,
    },
    rolling_converge_baseline_tokens: ready,
    baseline_sample_count: baseline?.sample_count ?? 0,
    provenance: "metered_provider",
  };
}
