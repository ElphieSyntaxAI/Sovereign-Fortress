/**
 * Per-tenant Redis counters for token-savings features (24h window) — dashboard + admin visibility.
 */

import { msgfRedisKey, redisGet, redisIncrWithWindow, redisSet } from "@/lib/redis";
import { isCreditReservationEnabled } from "@/lib/credit-reservation";
import { isConvergeCacheEnabled } from "@/lib/services/converge-cache";
import { isIngestHashSkipEnabled } from "@/lib/services/ingest-hash-cache";
import { isPulseIdempotencyEnabled } from "@/lib/services/pulse-idempotency";
import {
  getPulseRoutingMix24h,
  type PulseRoutingMix,
} from "@/lib/services/pulse-routing-stats";
import { isUsageMonitorWriteEnabled } from "@/lib/usage-monitor";

const WINDOW_SEC = 86_400;

export type SavingsFeatureMetricKey =
  | "converge_cache_hit"
  | "dev_event"
  | "dev_event_vault_hit"
  | "pulse_idempotency_replay"
  | "ingest_hash_files_skipped"
  | "credit_reserve_ok"
  | "credit_reserve_denied"
  | "dev_session_pulse";

export type SavingsFeatureCatalogEntry = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  api_or_env: string;
  admin_visible: boolean;
};

export type SavingsFeatureCounters = {
  converge_cache_hits: number;
  converge_cache_tokens_saved: number;
  dev_events: number;
  dev_event_vault_hits: number;
  dev_event_tokens_saved: number;
  pulse_idempotency_replays: number;
  ingest_hash_files_skipped: number;
  credit_reservations: number;
  credit_reservation_denied: number;
  dev_session_pulses: number;
};

export type SavingsFeaturesSummary = {
  tenant_id: string;
  window_hours: 24;
  counters: SavingsFeatureCounters;
  pulse_routing: PulseRoutingMix;
  catalog: SavingsFeatureCatalogEntry[];
};

async function readCounter(key: string): Promise<number> {
  const raw = await redisGet(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function buildSavingsFeatureCatalog(): SavingsFeatureCatalogEntry[] {
  const convergeCtxCap =
    Number(process.env.MSGF_CONVERGE_MAX_CONTEXT_TOKENS?.trim()) || 2400;
  return [
    {
      id: "pulse_routing",
      label: "Pulse routing mix",
      description: "Local gateway vs global CONVERGE — estimated tokens saved vs naive dual-cloud.",
      enabled: true,
      api_or_env: "GET /api/msgf/dashboard/pulse-routing",
      admin_visible: true,
    },
    {
      id: "converge_cache",
      label: "CONVERGE result cache",
      description: "Redis replay of identical content hashes — skips dual-model orchestration on hit.",
      enabled: isConvergeCacheEnabled(),
      api_or_env: "MSGF_CONVERGE_CACHE_ENABLED · MSGF_CONVERGE_CACHE_TTL_SEC",
      admin_visible: true,
    },
    {
      id: "dev_event",
      label: "IDE dev-event (Heal Cheap)",
      description: "POST /api/msgf/dev-event build_failed — vault-first, no biometric Pulse pipeline.",
      enabled: true,
      api_or_env: "POST /api/msgf/dev-event · MSGF_DEV_EVENT_*",
      admin_visible: true,
    },
    {
      id: "dev_session",
      label: "IDE dev-session",
      description: "Relaxed logic drift during vibe coding; save-primary flush and build-active discount.",
      enabled: true,
      api_or_env: "x-msgf-dev-session · MSGF_DEV_SESSION_*",
      admin_visible: true,
    },
    {
      id: "pulse_idempotency",
      label: "Pulse idempotency",
      description: "Duplicate Idempotency-Key within TTL returns cached Pulse JSON.",
      enabled: isPulseIdempotencyEnabled(),
      api_or_env: "MSGF_PULSE_IDEMPOTENCY_ENABLED",
      admin_visible: true,
    },
    {
      id: "ingest_hash",
      label: "Ingest content-hash skip",
      description: "Skip SWEEP re-ingest when file SHA unchanged.",
      enabled: isIngestHashSkipEnabled(),
      api_or_env: "MSGF_INGEST_HASH_SKIP",
      admin_visible: true,
    },
    {
      id: "usage_monitor",
      label: "usage_monitor",
      description: "Cumulative estimated tokens per actor (aligns with credit guard cap).",
      enabled: isUsageMonitorWriteEnabled(),
      api_or_env: "MSGF_USAGE_MONITOR_WRITE · msgf_usage_monitor_add",
      admin_visible: true,
    },
    {
      id: "credit_reservation",
      label: "Credit reservation",
      description: "Reserve credits before Pulse/ingest LLM work; 402 when insufficient.",
      enabled: isCreditReservationEnabled(),
      api_or_env: "MSGF_CREDIT_RESERVATION_ENABLED",
      admin_visible: true,
    },
    {
      id: "converge_context_budget",
      label: "CONVERGE context budget",
      description: "Caps vault + beats + P2 + DEFEND blocks before global CONVERGE.",
      enabled: convergeCtxCap > 0,
      api_or_env: `MSGF_CONVERGE_MAX_CONTEXT_TOKENS (${convergeCtxCap})`,
      admin_visible: true,
    },
  ];
}

export async function recordSavingsFeatureCount(
  tenantId: string,
  metric: SavingsFeatureMetricKey,
  delta = 1
): Promise<void> {
  const tid = tenantId.trim();
  if (!tid || delta <= 0) return;
  await redisIncrWithWindow(msgfRedisKey("savings", tid, metric, "count"), WINDOW_SEC);
}

export async function recordSavingsFeatureTokensSaved(
  tenantId: string,
  metric: "converge_cache_hit" | "dev_event" | "dev_event_vault_hit",
  tokensSaved: number
): Promise<void> {
  const tid = tenantId.trim();
  const delta = Math.floor(tokensSaved);
  if (!tid || delta <= 0) return;
  const key = msgfRedisKey("savings", tid, metric, "tokens_saved");
  const prior = await readCounter(key);
  await redisSet(key, String(prior + delta), WINDOW_SEC);
}

export async function getSavingsFeaturesSummary24h(
  tenantId: string
): Promise<SavingsFeaturesSummary> {
  const tid = tenantId.trim();
  const prefix = (metric: SavingsFeatureMetricKey) =>
    msgfRedisKey("savings", tid, metric, "count");
  const tokenKey = (metric: "converge_cache_hit" | "dev_event" | "dev_event_vault_hit") =>
    msgfRedisKey("savings", tid, metric, "tokens_saved");

  const [
    pulse_routing,
    converge_cache_hits,
    converge_cache_tokens_saved,
    dev_events,
    dev_event_vault_hits,
    dev_event_tokens_saved,
    pulse_idempotency_replays,
    ingest_hash_files_skipped,
    credit_reservations,
    credit_reservation_denied,
    dev_session_pulses,
  ] = await Promise.all([
    getPulseRoutingMix24h(tid),
    readCounter(prefix("converge_cache_hit")),
    readCounter(tokenKey("converge_cache_hit")),
    readCounter(prefix("dev_event")),
    readCounter(prefix("dev_event_vault_hit")),
    readCounter(tokenKey("dev_event_vault_hit")),
    readCounter(prefix("pulse_idempotency_replay")),
    readCounter(prefix("ingest_hash_files_skipped")),
    readCounter(prefix("credit_reserve_ok")),
    readCounter(prefix("credit_reserve_denied")),
    readCounter(prefix("dev_session_pulse")),
  ]);

  return {
    tenant_id: tid,
    window_hours: 24,
    counters: {
      converge_cache_hits,
      converge_cache_tokens_saved,
      dev_events,
      dev_event_vault_hits,
      dev_event_tokens_saved,
      pulse_idempotency_replays,
      ingest_hash_files_skipped,
      credit_reservations,
      credit_reservation_denied,
      dev_session_pulses,
    },
    pulse_routing,
    catalog: buildSavingsFeatureCatalog(),
  };
}
