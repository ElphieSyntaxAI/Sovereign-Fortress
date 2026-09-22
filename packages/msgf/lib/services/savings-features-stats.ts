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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
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
import {
  BRAIN_FEATURE_CATALOG,
  audienceForBrainTier,
  filterCatalogEntriesForAudience,
  MSGF_BRAIN_BIG,
  MSGF_BRAIN_SMALL,
  savingsCatalogFeatureIdToBrainId,
  type BrainAudience,
  type MsgfBrainTier,
} from "@/lib/services/brain-routing-policy";

const WINDOW_SEC = 86_400;

export type SavingsFeatureMetricKey =
  | "converge_cache_hit"
  | "dev_event"
  | "dev_event_vault_hit"
  | "pulse_idempotency_replay"
  | "ingest_hash_files_skipped"
  | "credit_reserve_ok"
  | "credit_reserve_denied"
  | "dev_session_pulse"
  | "agent_context_pack"
  | "verify_result_pass"
  | "verify_result_fail"
  | "verify_result_vault"
  | "verify_result_hall"
  | "run_script_rerun";

export type SavingsFeatureCatalogEntry = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  api_or_env: string;
  admin_visible: boolean;
  brain_tier: MsgfBrainTier;
  audience: BrainAudience;
  requires_admin_for_global: boolean;
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
  agent_context_packs: number;
  verify_result_passes: number;
  verify_result_failures: number;
  verify_result_vault_writes: number;
  verify_result_hall_writes: number;
  verify_result_vault_tokens_saved: number;
  run_script_reruns: number;
  run_script_rerun_tokens_saved: number;
};

export type SavingsFeaturesSummary = {
  tenant_id: string;
  window_hours: 24;
  audience_scope: BrainAudience;
  counters: SavingsFeatureCounters;
  pulse_routing: PulseRoutingMix;
  /** User-facing Small Brain pulse share (excludes global CONVERGE from denominator). */
  small_brain_pulse_pct: number;
  big_brain_global_converge_pulses: number;
  catalog: SavingsFeatureCatalogEntry[];
};

async function readCounter(key: string): Promise<number> {
  const raw = await redisGet(key);
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function catalogRow(
  id: string,
  label: string,
  description: string,
  enabled: boolean,
  api_or_env: string
): SavingsFeatureCatalogEntry {
  const brainId = savingsCatalogFeatureIdToBrainId(id);
  const brain = brainId
    ? BRAIN_FEATURE_CATALOG.find((f) => f.id === brainId)
    : undefined;
  return {
    id,
    label,
    description,
    enabled,
    api_or_env,
    admin_visible: true,
    brain_tier: brain?.tier ?? MSGF_BRAIN_SMALL,
    requires_admin_for_global: brain?.requires_admin_for_global ?? false,
    audience: brain?.audience ?? audienceForBrainTier(brain?.tier ?? MSGF_BRAIN_SMALL),
  };
}

export function buildSavingsFeatureCatalog(): SavingsFeatureCatalogEntry[] {
  const convergeCtxCap =
    Number(process.env.MSGF_CONVERGE_MAX_CONTEXT_TOKENS?.trim()) || 2400;
  return [
    catalogRow(
      "pulse_routing",
      "Pulse routing mix",
      "Small Brain (local gateway / bypass) vs Big Brain (global CONVERGE). Global DNA writes need admin when globalize is requested.",
      true,
      "GET /api/msgf/dashboard/pulse-routing · logic-drift threshold"
    ),
    catalogRow(
      "converge_cache",
      "CONVERGE result cache",
      "Small Brain replay of a prior Big Brain verdict — tenant Redis only.",
      isConvergeCacheEnabled(),
      "MSGF_CONVERGE_CACHE_ENABLED · MSGF_CONVERGE_CACHE_TTL_SEC"
    ),
    catalogRow(
      "dev_event",
      "IDE dev-event (Heal Cheap)",
      "Small Brain only — tenant Vault / Flash heal; never escalates to global CONVERGE.",
      true,
      "POST /api/msgf/dev-event · MSGF_DEV_EVENT_*"
    ),
    catalogRow(
      "dev_session",
      "IDE dev-session",
      "Keeps routine typing on Small Brain longer (relaxed drift, save-primary flush).",
      true,
      "x-msgf-dev-session · MSGF_DEV_SESSION_*"
    ),
    catalogRow(
      "pulse_idempotency",
      "Pulse idempotency",
      "Small Brain — cached Pulse response for duplicate keys.",
      isPulseIdempotencyEnabled(),
      "MSGF_PULSE_IDEMPOTENCY_ENABLED"
    ),
    catalogRow(
      "ingest_hash",
      "Ingest content-hash skip",
      "Small Brain — skip unchanged files in tenant silo.",
      isIngestHashSkipEnabled(),
      "MSGF_INGEST_HASH_SKIP"
    ),
    catalogRow(
      "usage_monitor",
      "usage_monitor",
      "Per-actor token accounting — does not promote logic globally.",
      isUsageMonitorWriteEnabled(),
      "MSGF_USAGE_MONITOR_WRITE · msgf_usage_monitor_add"
    ),
    catalogRow(
      "credit_reservation",
      "Credit reservation",
      "Guards spend before optional Big Brain CONVERGE.",
      isCreditReservationEnabled(),
      "MSGF_CREDIT_RESERVATION_ENABLED"
    ),
    catalogRow(
      "agent_context_pack",
      "0-Token prompt + context pack",
      "Prompt optimizer and guided agent-context — sharded @ attachments vs whole-repo paste.",
      true,
      "POST /api/msgf/prompt-optimizer · GET /api/msgf/agent-context"
    ),
    catalogRow(
      "verify_result",
      "IDE verify-result loop",
      "Safe Build + Run Scripts — pass → Vault (pack-linked), repeated fail → Hall (deduped).",
      true,
      "POST /api/msgf/verify-result · MSGF_VERIFY_HALL_FAIL_THRESHOLD"
    ),
    catalogRow(
      "run_scripts",
      "Run Scripts (zero re-prompt)",
      "Re-run .msgf/run-scripts.json verify commands without regenerating the optimizer prompt.",
      true,
      "IDE Command Center → Run Scripts · msgf.runVerifyScripts"
    ),
    catalogRow(
      "converge_context_budget",
      "CONVERGE context budget",
      "Reduces unnecessary Big Brain context before escalation.",
      convergeCtxCap > 0,
      `MSGF_CONVERGE_MAX_CONTEXT_TOKENS (${convergeCtxCap})`
    ),
    {
      id: "big_brain_global_converge",
      label: "Big Brain — global CONVERGE",
      description:
        "Dual-model path when logic drift exceeds threshold. Vault/globalize uses Global Approval Gate.",
      enabled: true,
      api_or_env: "Pulse pipeline CONVERGE phase · assertGlobalWriteAllowed",
      admin_visible: true,
      brain_tier: MSGF_BRAIN_BIG,
      audience: "admin",
      requires_admin_for_global: true,
    },
    {
      id: "big_brain_admin_promotion",
      label: "Big Brain — admin promotion",
      description:
        "Rule submissions, human arbitration (scope global), and vault_core/msgf_rules writes.",
      enabled: true,
      api_or_env: "GET /api/msgf/admin/rule-submissions · global-approval-gate",
      admin_visible: true,
      brain_tier: MSGF_BRAIN_BIG,
      audience: "admin",
      requires_admin_for_global: true,
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
  metric:
    | "converge_cache_hit"
    | "dev_event"
    | "dev_event_vault_hit"
    | "verify_result_vault"
    | "run_script_rerun",
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
  tenantId: string,
  audience: BrainAudience = "user"
): Promise<SavingsFeaturesSummary> {
  const tid = tenantId.trim();
  const prefix = (metric: SavingsFeatureMetricKey) =>
    msgfRedisKey("savings", tid, metric, "count");
  const tokenKey = (
    metric:
      | "converge_cache_hit"
      | "dev_event"
      | "dev_event_vault_hit"
      | "verify_result_vault"
      | "run_script_rerun"
  ) => msgfRedisKey("savings", tid, metric, "tokens_saved");

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
    agent_context_packs,
    verify_result_passes,
    verify_result_failures,
    verify_result_vault_writes,
    verify_result_hall_writes,
    verify_result_vault_tokens_saved,
    run_script_reruns,
    run_script_rerun_tokens_saved,
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
    readCounter(prefix("agent_context_pack")),
    readCounter(prefix("verify_result_pass")),
    readCounter(prefix("verify_result_fail")),
    readCounter(prefix("verify_result_vault")),
    readCounter(prefix("verify_result_hall")),
    readCounter(tokenKey("verify_result_vault")),
    readCounter(prefix("run_script_rerun")),
    readCounter(tokenKey("run_script_rerun")),
  ]);

  const smallBrainPulses =
    pulse_routing.local_gateway +
    pulse_routing.converge_bypass +
    pulse_routing.converge_degraded;
  const small_brain_pulse_pct =
    pulse_routing.total_pulses > 0
      ? Math.round((smallBrainPulses / pulse_routing.total_pulses) * 1000) / 10
      : 0;

  const fullCatalog = buildSavingsFeatureCatalog();

  return {
    tenant_id: tid,
    window_hours: 24,
    audience_scope: audience,
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
      agent_context_packs,
      verify_result_passes,
      verify_result_failures,
      verify_result_vault_writes,
      verify_result_hall_writes,
      verify_result_vault_tokens_saved,
      run_script_reruns,
      run_script_rerun_tokens_saved,
    },
    pulse_routing,
    small_brain_pulse_pct,
    big_brain_global_converge_pulses: pulse_routing.global_converge,
    catalog: filterCatalogEntriesForAudience(fullCatalog, audience),
  };
}
