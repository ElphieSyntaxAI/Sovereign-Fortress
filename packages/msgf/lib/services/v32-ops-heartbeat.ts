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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
/**
 * V3.2-ULTRA scheduled ops heartbeat — isolated ARBITRATE tier batches + PERSIST Hall purge.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HALL_PURGE_DEFAULT_RETENTION_DAYS,
  runHallPurgeProtocol,
  type HallPurgeProtocolResult,
} from "@/lib/services/hall-purge-protocol";
import {
  HALL_REDIS_PURGE_DEFAULT_RETENTION_DAYS,
  runHallRedisPurge,
  type HallRedisPurgeResult,
} from "@/lib/services/hall-redis-purge";
import {
  runCronScheduledHealBatches,
  type CronScheduledHealBatchResult,
} from "@/lib/services/heal-queue-cron-batch";
import {
  runV32TierMaintenance,
  type TierMaintenanceResult,
} from "@/lib/services/v32-tier-maintenance";

export type V32RoutineStatus<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

export type V32OpsHeartbeatInput = {
  admin: SupabaseClient;
  dryRun?: boolean;
  hallPurgeDays?: number;
  skipTierBatches?: boolean;
  skipHallPurge?: boolean;
  skipScheduledHeal?: boolean;
  /** Cron cadence hours (default 6, matches GitHub `msgf-tier-heartbeat.yml`). */
  cronPeriodHours?: number;
};

export type V32OpsHeartbeatResult = {
  ok: boolean;
  protocol: "v3.2_ops_heartbeat";
  started_at: string;
  finished_at: string;
  dry_run: boolean;
  routines: {
    tier_batches: V32RoutineStatus<TierMaintenanceResult> | { ok: true; skipped: true };
    scheduled_heal_batch:
      | V32RoutineStatus<CronScheduledHealBatchResult>
      | { ok: true; skipped: true };
    hall_purge_cold: V32RoutineStatus<HallPurgeProtocolResult> | { ok: true; skipped: true };
    hall_purge_redis: V32RoutineStatus<HallRedisPurgeResult> | { ok: true; skipped: true };
  };
};

async function runTierBatchesRoutine(
  admin: SupabaseClient
): Promise<V32RoutineStatus<TierMaintenanceResult>> {
  try {
    const result = await runV32TierMaintenance(admin);
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "tier batch maintenance failed";
    console.error("[v32-ops-heartbeat] tier_batches", e);
    return { ok: false, error: message };
  }
}

async function runHallPurgeColdRoutine(params: {
  admin: SupabaseClient;
  days: number;
  dryRun: boolean;
}): Promise<V32RoutineStatus<HallPurgeProtocolResult>> {
  try {
    const result = await runHallPurgeProtocol({
      supabase: params.admin,
      days: params.days,
      dryRun: params.dryRun,
      execute: !params.dryRun,
    });
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "cold Hall purge failed";
    console.error("[v32-ops-heartbeat] hall_purge_cold", e);
    return { ok: false, error: message };
  }
}

async function runScheduledHealBatchRoutine(params: {
  admin: SupabaseClient;
  dryRun: boolean;
  cronPeriodHours: number;
}): Promise<V32RoutineStatus<CronScheduledHealBatchResult>> {
  try {
    const result = await runCronScheduledHealBatches({
      admin: params.admin,
      dryRun: params.dryRun,
      periodHours: params.cronPeriodHours,
    });
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "scheduled heal batch failed";
    console.error("[v32-ops-heartbeat] scheduled_heal_batch", e);
    return { ok: false, error: message };
  }
}

async function runHallPurgeRedisRoutine(params: {
  days: number;
  dryRun: boolean;
}): Promise<V32RoutineStatus<HallRedisPurgeResult>> {
  try {
    const result = await runHallRedisPurge({
      days: params.days,
      dryRun: params.dryRun,
    });
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Redis Hall purge failed";
    console.error("[v32-ops-heartbeat] hall_purge_redis", e);
    return { ok: false, error: message };
  }
}

/**
 * Run maintenance routines in isolation — one failure does not block the other.
 */
export async function runV32OpsHeartbeat(
  input: V32OpsHeartbeatInput
): Promise<V32OpsHeartbeatResult> {
  const startedAt = new Date().toISOString();
  const dryRun = input.dryRun === true;
  const hallDays = input.hallPurgeDays ?? HALL_PURGE_DEFAULT_RETENTION_DAYS;

  const tier_batches =
    input.skipTierBatches || dryRun
      ? ({ ok: true as const, skipped: true as const })
      : await runTierBatchesRoutine(input.admin);

  const cronPeriodHours = input.cronPeriodHours ?? 6;

  const scheduled_heal_batch =
    input.skipScheduledHeal
      ? ({ ok: true as const, skipped: true as const })
      : await runScheduledHealBatchRoutine({
          admin: input.admin,
          dryRun,
          cronPeriodHours,
        });

  const hall_purge_cold = input.skipHallPurge
    ? ({ ok: true as const, skipped: true as const })
    : await runHallPurgeColdRoutine({
        admin: input.admin,
        days: hallDays,
        dryRun,
      });

  const hall_purge_redis = input.skipHallPurge
    ? ({ ok: true as const, skipped: true as const })
    : await runHallPurgeRedisRoutine({
        days: hallDays,
        dryRun,
      });

  const routinesFailed =
    ("ok" in tier_batches && tier_batches.ok === false) ||
    ("ok" in scheduled_heal_batch && scheduled_heal_batch.ok === false) ||
    ("ok" in hall_purge_cold && hall_purge_cold.ok === false) ||
    ("ok" in hall_purge_redis && hall_purge_redis.ok === false);

  return {
    ok: !routinesFailed,
    protocol: "v3.2_ops_heartbeat",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    dry_run: dryRun,
    routines: {
      tier_batches,
      scheduled_heal_batch,
      hall_purge_cold,
      hall_purge_redis,
    },
  };
}

export { HALL_PURGE_DEFAULT_RETENTION_DAYS, HALL_REDIS_PURGE_DEFAULT_RETENTION_DAYS };
