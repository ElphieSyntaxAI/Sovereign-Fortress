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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * MSGF V3.2-ULTRA master directive — runtime labels for Pulse, health, and ops.
 * @see docs/MSGF_V1_ROADMAP.md §2.6
 */

import {
  ensureRedisConnectedWithTimeout,
  isRedisConfigured,
} from "@/lib/redis";
import type { PulseHotSession } from "@/lib/services/pulse-hot-session";
import type { ShadowPreflightResult } from "@/lib/msgf-shadow";

export const V32_ULTRA_STEPS = [
  "SWEEP",
  "SHARD",
  "DEFEND",
  "CROSS_REF",
  "CONVERGE",
  "ARBITRATE",
  "PERSIST",
] as const;

export type V32UltraStep = (typeof V32_ULTRA_STEPS)[number];

export type V32DirectiveTrace = {
  sweep: "pre_ingestion_audit_ref";
  shard: "hot" | "cold";
  defend: { tier: string; blocked: boolean };
  cross_ref: {
    vault_match: boolean;
    hall_match: boolean;
    lineage_redis_hit?: boolean;
    hot_slice_prefetched?: boolean;
  };
  converge: "local_gateway" | "dual_model" | "bypass" | "degraded" | "skipped";
  arbitrate: "none" | "hitl_required" | "human_confirmed" | "recursion_limit";
  persist: "vault" | "hall" | "baseline_only" | "blocked";
};

export function buildPulseV32Directive(params: {
  hotSession?: PulseHotSession;
  preflight?: ShadowPreflightResult;
  converge?: V32DirectiveTrace["converge"];
  arbitrate?: V32DirectiveTrace["arbitrate"];
  persist?: V32DirectiveTrace["persist"];
  lineageRedisHit?: boolean;
}): V32DirectiveTrace {
  const preflight = params.preflight;
  return {
    sweep: "pre_ingestion_audit_ref",
    shard: params.hotSession?.mode ?? "cold",
    defend: {
      tier: preflight?.tier ?? "UNKNOWN",
      blocked: preflight?.blocked ?? false,
    },
    cross_ref: {
      vault_match: Boolean(preflight?.vaultMatch),
      hall_match: Boolean(preflight?.hallMatch),
      lineage_redis_hit: params.lineageRedisHit ?? params.hotSession?.lineagePrefetchHit,
      hot_slice_prefetched: params.hotSession?.activeSlicePrefetched,
    },
    converge: params.converge ?? "local_gateway",
    arbitrate: params.arbitrate ?? "none",
    persist: params.persist ?? "vault",
  };
}

export function inferV32FromPulseForensic(
  forensic: Record<string, unknown> | undefined,
  hotSession?: PulseHotSession
): V32DirectiveTrace | undefined {
  if (!forensic) return undefined;
  const preflight = forensic.defend_preflight as ShadowPreflightResult | undefined;
  const kind = String(forensic.kind ?? "");
  let converge: V32DirectiveTrace["converge"] = "local_gateway";
  if (kind.includes("bypass") || kind.includes("degraded")) converge = "bypass";
  if (forensic.dual_model_gateway) converge = "dual_model";

  let arbitrate: V32DirectiveTrace["arbitrate"] = "none";
  if (forensic.err === "ERR_RECURSION_LIMIT" || kind.includes("recursion")) {
    arbitrate = "recursion_limit";
  } else if (preflight?.tier === "RED" && preflight.blocked) {
    arbitrate = "hitl_required";
  }

  let persist: V32DirectiveTrace["persist"] = "vault";
  if (kind.includes("baseline")) persist = "baseline_only";
  if (preflight?.blocked) persist = "blocked";
  if (kind.includes("hall")) persist = "hall";

  return buildPulseV32Directive({
    hotSession,
    preflight,
    converge,
    arbitrate,
    persist,
    lineageRedisHit: forensic.lineage_redis_hit === true,
  });
}

export type V32RuntimeStepStatus = {
  step: V32UltraStep;
  status: "ok" | "degraded" | "missing";
  detail: string;
};

export type V32RuntimeStatus = {
  evaluated_at: string;
  steps: V32RuntimeStepStatus[];
  production_ready: boolean;
};

function envRequireRedis(): boolean {
  const v = process.env.MSGF_REQUIRE_REDIS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Live checklist for /health and /status (no Pulse execution). */
export async function evaluateV32RuntimeStatus(): Promise<V32RuntimeStatus> {
  const steps: V32RuntimeStepStatus[] = [];

  steps.push({
    step: "SWEEP",
    status: "ok",
    detail: "pre_ingestion_audit.md maintained; ingest uses SWEEP lineage map.",
  });

  let shardStatus: V32RuntimeStepStatus["status"] = "missing";
  let shardDetail = "UPSTASH_REDIS_REST_* or REDIS_HOST or REDIS_URL unset — cold Postgres only.";
  if (isRedisConfigured()) {
    const redis = await ensureRedisConnectedWithTimeout(
      Number(process.env.MSGF_REDIS_CONNECT_TIMEOUT_MS || 2_000)
    );
    if (redis) {
      shardStatus = "ok";
      shardDetail = `Redis ping OK (${process.env.UPSTASH_REDIS_REST_URL?.trim() ? "Upstash REST" : "TCP"}) — hot layer available for Pulse SHARD.`;
    } else {
      shardStatus = envRequireRedis() ? "missing" : "degraded";
      shardDetail = envRequireRedis()
        ? "Redis required (MSGF_REQUIRE_REDIS) but unreachable."
        : "Redis configured but ping failed — fail-open to cold layer.";
    }
  } else if (envRequireRedis()) {
    shardDetail = "MSGF_REQUIRE_REDIS=1 but no Redis host/URL configured.";
  }

  steps.push({ step: "SHARD", status: shardStatus, detail: shardDetail });

  steps.push({
    step: "DEFEND",
    status: "ok",
    detail: "PulseEngine.runThroughDefend → gate, crossRef, defend (shadow preflight).",
  });

  steps.push({
    step: "CROSS_REF",
    status: "ok",
    detail: "preFlightCheck + Vault/Hall lineage on Pulse; ingest shadow gate before SWEEP.",
  });

  const vertexReady = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.GCP_PROJECT_ID?.trim() ||
      process.env.MSGF_VERTEX_PROJECT?.trim()
  );
  steps.push({
    step: "CONVERGE",
    status: vertexReady ? "ok" : "degraded",
    detail: vertexReady
      ? "Dual-model / local gateway in PulseEngine (Vertex env present)."
      : "Set GOOGLE_APPLICATION_CREDENTIALS or GCP project for full CONVERGE.",
  });

  const opsDedicatedSecret =
    process.env.MSGF_OPS_CRON_SECRET?.trim() || process.env.MSGF_ADMIN_API_KEY?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const arbitrateAuthReady = Boolean(opsDedicatedSecret || serviceRole);
  steps.push({
    step: "ARBITRATE",
    status: arbitrateAuthReady ? "ok" : "degraded",
    detail: !arbitrateAuthReady
      ? "Set MSGF_OPS_CRON_SECRET, MSGF_ADMIN_API_KEY, or SUPABASE_SERVICE_ROLE_KEY for ops routes."
      : opsDedicatedSecret
        ? "Dashboard Human Arbitrate + ERR_RECURSION_LIMIT in PulseEngine."
        : "Ops auth via service role. Add MSGF_OPS_CRON_SECRET for scheduled v32-heartbeat (avoid service role in cron).",
  });

  steps.push({
    step: "PERSIST",
    status: "ok",
    detail:
      "Vault/Hall persist + POST /api/msgf/ops/v32-heartbeat (tier batches + 30d Hall purge).",
  });

  const production_ready =
    (!envRequireRedis() || shardStatus === "ok") &&
    steps.every((s) => s.status !== "missing");

  return {
    evaluated_at: new Date().toISOString(),
    steps,
    production_ready,
  };
}

export function isRedisRequiredForPulse(): boolean {
  return envRequireRedis();
}
