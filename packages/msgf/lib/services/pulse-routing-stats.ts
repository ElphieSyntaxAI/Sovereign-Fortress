/**
 * Per-tenant Pulse routing counters (24h window) for dashboard mix + savings visibility.
 */

import { msgfRedisKey, redisGet, redisIncrWithWindow, redisSet } from "@/lib/redis";
import { normalizePulseRouting } from "@/lib/services/token-usage-estimate";

const WINDOW_SEC = 86_400;

export type PulseRoutingMix = {
  tenant_id: string;
  window_hours: 24;
  total_pulses: number;
  local_gateway: number;
  converge_bypass: number;
  converge_degraded: number;
  global_converge: number;
  local_or_bypass_pct: number;
  estimated_tokens_saved_vs_naive: number;
};

function routingBucket(raw: string | null | undefined): keyof Omit<
  PulseRoutingMix,
  "tenant_id" | "window_hours" | "total_pulses" | "local_or_bypass_pct" | "estimated_tokens_saved_vs_naive"
> {
  const kind = normalizePulseRouting(raw);
  switch (kind) {
    case "local_gateway":
      return "local_gateway";
    case "converge_bypass":
      return "converge_bypass";
    case "converge_soft_cap_degraded":
    case "converge_timeout_degraded":
      return "converge_degraded";
    case "global_converge":
    case "dual_model_local":
      return "global_converge";
    default:
      return "local_gateway";
  }
}

export async function recordPulseRoutingOutcome(
  tenantId: string,
  routing: string | null | undefined,
  tokensSavedEstimate = 0
): Promise<void> {
  const tid = tenantId.trim();
  if (!tid) return;

  const bucket = routingBucket(routing);
  await redisIncrWithWindow(msgfRedisKey("pulse-route", tid, bucket), WINDOW_SEC);
  await redisIncrWithWindow(msgfRedisKey("pulse-route", tid, "total"), WINDOW_SEC);

  if (tokensSavedEstimate > 0) {
    const savedKey = msgfRedisKey("pulse-route", tid, "tokens_saved");
    const prior = await readCounter(savedKey);
    await redisSet(savedKey, String(prior + Math.floor(tokensSavedEstimate)), WINDOW_SEC);
  }
}

async function readCounter(key: string): Promise<number> {
  const raw = await redisGet(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function getPulseRoutingMix24h(tenantId: string): Promise<PulseRoutingMix> {
  const tid = tenantId.trim();
  const [total, local, bypass, degraded, global, savedRaw] = await Promise.all([
    readCounter(msgfRedisKey("pulse-route", tid, "total")),
    readCounter(msgfRedisKey("pulse-route", tid, "local_gateway")),
    readCounter(msgfRedisKey("pulse-route", tid, "converge_bypass")),
    readCounter(msgfRedisKey("pulse-route", tid, "converge_degraded")),
    readCounter(msgfRedisKey("pulse-route", tid, "global_converge")),
    readCounter(msgfRedisKey("pulse-route", tid, "tokens_saved")),
  ]);

  const cheap = local + bypass + degraded;
  const local_or_bypass_pct =
    total > 0 ? Math.round((cheap / total) * 1000) / 10 : 0;

  return {
    tenant_id: tid,
    window_hours: 24,
    total_pulses: total,
    local_gateway: local,
    converge_bypass: bypass,
    converge_degraded: degraded,
    global_converge: global,
    local_or_bypass_pct,
    estimated_tokens_saved_vs_naive: savedRaw,
  };
}
