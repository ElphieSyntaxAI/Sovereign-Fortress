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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * Cron-driven scheduled heal batches — v32-heartbeat + MSGF_OPS_CRON_SECRET.
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HealQueuePresetIntervalSchema,
  type HealQueuePresetInterval,
  type RemediationTask,
  RemediationTaskSchema,
} from "@/lib/schemas/heal-queue";
import {
  GenealogicalBugIndexSchema,
  PULSE_BUG_INDEX,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import type { MsgfGovernancePillar } from "@/lib/schemas/vault-hall-metadata";
import {
  buildIngestLineageForFile,
  pathToGenealogicalBugIndex,
} from "@/lib/services/IngestService";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import {
  buildRemediationFixTemplate,
  remediationEngine,
  type BulkRemediationBatchPlan,
  type ModularRemediationStrategy,
} from "@/lib/services/RemediationEngine";
import { persistToVault } from "@/lib/services/constraint-ledger";
import {
  isCircuitBreakerTripped,
  recordRemediationFailure,
  recordRemediationSuccess,
  REMEDIATION_STATE,
} from "@/lib/services/remediation-retry-circuit";

/** Aligns with msgf-tier-heartbeat.yml (every 6 hours). */
export const V32_CRON_PERIOD_HOURS_DEFAULT = 6;

export type CronHeartbeatWindow = {
  executedAt: Date;
  periodHours: number;
};

export type ScheduledPillarVectorRow = {
  id: string;
  tenant_id: string;
  metadata: Record<string, unknown>;
  scheduling_tier: string | null;
  preset_interval: HealQueuePresetInterval;
  remediation_state: string | null;
  remediation_attempt_count: number;
};

export type TenantCronHealSummary = {
  tenant_id: string;
  task_count: number;
  row_ids_cleared: string[];
  batch_plan: BulkRemediationBatchPlan;
  token_estimate: {
    individual_execution_tokens: number;
    batch_execution_tokens: number;
    tokens_saved_vs_individual: number;
  };
};

export type CronScheduledHealBatchResult = {
  ok: true;
  protocol: "v3.2_cron_scheduled_heal_batch";
  executed_at: string;
  dry_run: boolean;
  cron_period_hours: number;
  preset_intervals_due: HealQueuePresetInterval[];
  rows_matched: number;
  tenants_processed: number;
  rows_healed: number;
  rows_cleared: number;
  token_summary: {
    individual_execution_tokens: number;
    batch_execution_tokens: number;
    tokens_saved_vs_individual: number;
  };
  by_tenant: TenantCronHealSummary[];
};

function parsePresetInterval(meta: Record<string, unknown>): HealQueuePresetInterval | null {
  const parsed = HealQueuePresetIntervalSchema.safeParse(meta.preset_interval);
  return parsed.success ? parsed.data : null;
}

function parseBugIndexFromMetadata(meta: Record<string, unknown>): GenealogicalBugIndex | null {
  const parsed = GenealogicalBugIndexSchema.safeParse(meta.bug_index);
  if (parsed.success) return parsed.data;
  const instance = typeof meta.instance_slug === "string" ? meta.instance_slug : null;
  const category = typeof meta.category === "string" ? meta.category : null;
  const branch = typeof meta.branch === "string" ? meta.branch : null;
  if (instance && category && branch) {
    const coerced = GenealogicalBugIndexSchema.safeParse({
      level_1_category: category,
      level_1_1_branch: branch,
      level_1_1_1_instance: instance,
    });
    if (coerced.success) return coerced.data;
  }
  return null;
}

function governancePillarFromMetadata(meta: Record<string, unknown>): MsgfGovernancePillar {
  const g = meta.governance_pillar ?? meta.pillar;
  if (g === "P1" || g === "P2" || g === "P3" || g === "P4" || g === "P5" || g === "P6") {
    return g;
  }
  return "P6";
}

/**
 * v32-heartbeat scheduled heal — only user-flagged `6h` and `nightly` preset rows.
 * `nightly` runs in the first UTC window after midnight (hours 0 … periodHours−1).
 */
export function presetIntervalsDueThisCronCycle(
  window: CronHeartbeatWindow
): HealQueuePresetInterval[] {
  const hour = window.executedAt.getUTCHours();
  const due: HealQueuePresetInterval[] = ["6h"];

  if (hour < window.periodHours) {
    due.push("nightly");
  }

  return due;
}

export function estimateIndividualExecutionTokens(filePaths: readonly string[]): number {
  return Math.max(
    0,
    Math.floor(filePaths.reduce((sum, p) => sum + p.length, 0) / 4)
  );
}

export function estimateBatchExecutionTokens(plan: BulkRemediationBatchPlan): number {
  const groupedChars = plan.groups.reduce(
    (sum, g) => sum + g.path_prefix.length + g.file_paths.length * 8,
    0
  );
  const strategyChars = plan.strategies.reduce(
    (sum, s) => sum + s.fix.length + s.consequence.length,
    0
  );
  return Math.max(0, Math.floor((groupedChars + strategyChars) / 4));
}

export function remediationTaskFromScheduledRow(row: ScheduledPillarVectorRow): RemediationTask {
  const meta = row.metadata;
  const originalPath =
    typeof meta.original_path === "string"
      ? meta.original_path
      : typeof meta.file_path === "string"
        ? meta.file_path
        : `pillar-vector://${row.id}`;

  const bug_index =
    parseBugIndexFromMetadata(meta) ?? pathToGenealogicalBugIndex(originalPath);
  const lineage = buildIngestLineageForFile({ path: originalPath, content: "" });

  const tier = row.scheduling_tier;
  const scheduling_tier =
    tier === "RED" || tier === "YELLOW" || tier === "GREEN" ? tier : null;

  const circuitOpen = isCircuitBreakerTripped(row.remediation_state);

  return RemediationTaskSchema.parse({
    task_id: randomUUID(),
    file_path: originalPath,
    governance_pillar: lineage.governance_pillar ?? governancePillarFromMetadata(meta),
    bug_index: lineage.bug_index ?? bug_index,
    reason: circuitOpen
      ? "Circuit breaker — not eligible for cron batch"
      : `Cron scheduled heal (${row.preset_interval})`,
    source: "scheduled",
    pillar_vector_id: row.id,
    scheduling_tier,
    preset_interval: row.preset_interval,
    remediation_state: row.remediation_state as
      | "ACTIVE"
      | "SCHEDULED"
      | "PENDING_HUMAN_ARBITRATION"
      | "RESOLVED"
      | null,
    consecutive_failure_count: row.remediation_attempt_count,
    circuit_breaker_open: circuitOpen,
  });
}

export async function fetchScheduledPillarVectorsDueForCron(
  admin: SupabaseClient,
  dueIntervals: readonly HealQueuePresetInterval[]
): Promise<ScheduledPillarVectorRow[]> {
  const dueSet = new Set(dueIntervals);
  if (!dueSet.size) return [];

  const { data, error } = await admin
    .from("pillar_vectors")
    .select("id, metadata, scheduling_tier, remediation_state, remediation_attempt_count")
    .or("scheduling_tier.not.is.null,metadata->>heal_queue_pending.eq.true")
    .neq("remediation_state", REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION)
    .limit(3000);

  if (error) {
    throw new Error(`Scheduled heal-queue cron scan failed: ${error.message}`);
  }

  const out: ScheduledPillarVectorRow[] = [];

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const remediationState =
      typeof row.remediation_state === "string" ? row.remediation_state : null;
    if (isCircuitBreakerTripped(remediationState)) continue;

    const preset = parsePresetInterval(meta);
    if (!preset || !dueSet.has(preset)) continue;

    const healQueuePending = meta.heal_queue_pending === true;
    const scheduledState = remediationState === REMEDIATION_STATE.SCHEDULED;
    if (!healQueuePending && !scheduledState) continue;

    const tenantRaw = meta.tenant_id;
    if (typeof tenantRaw !== "string" || !tenantRaw.trim()) continue;

    out.push({
      id: row.id as string,
      tenant_id: tenantRaw.trim(),
      metadata: meta,
      scheduling_tier:
        typeof row.scheduling_tier === "string"
          ? row.scheduling_tier
          : typeof meta.scheduling_tier === "string"
            ? meta.scheduling_tier
            : null,
      preset_interval: preset,
      remediation_state: remediationState,
      remediation_attempt_count: Number(row.remediation_attempt_count ?? 0),
    });
  }

  return out;
}

export function groupScheduledRowsByTenant(
  rows: readonly ScheduledPillarVectorRow[]
): Map<string, ScheduledPillarVectorRow[]> {
  const map = new Map<string, ScheduledPillarVectorRow[]>();
  for (const row of rows) {
    const list = map.get(row.tenant_id) ?? [];
    list.push(row);
    map.set(row.tenant_id, list);
  }
  return map;
}

export type CronLomConsensusSettlement = {
  file_path: string;
  strategy_id: string;
  consequence_score: number;
  ledger: "vault";
};

export type ApplyBulkHealResult = {
  batch_plan: BulkRemediationBatchPlan;
  row_ids_cleared: string[];
  lom_consensus_settlements: CronLomConsensusSettlement[];
  token_estimate: TenantCronHealSummary["token_estimate"];
};

function entityIdFromTaskMetadata(
  tenantId: string,
  meta: Record<string, unknown>
): string {
  const raw = meta.entity_id ?? meta.author_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : tenantId;
}

/**
 * Prefix-shared batch healing — RemediationEngine LOM consensus pick + Vault persist per task.
 */
export async function applyBulkHealForTasks(params: {
  admin: SupabaseClient;
  tenantId: string;
  tasks: readonly RemediationTask[];
  dryRun?: boolean;
  cronNote?: string;
}): Promise<ApplyBulkHealResult> {
  const filePaths = params.tasks.map((t) => t.file_path);
  const batchInput = params.tasks.map((t) => ({
    file_path: t.file_path,
    bug_index_instance: t.bug_index.level_1_1_1_instance,
  }));

  const batch_plan = remediationEngine.buildBatchRemediationPlan(batchInput);
  const individual_execution_tokens = estimateIndividualExecutionTokens(filePaths);
  const batch_execution_tokens = estimateBatchExecutionTokens(batch_plan);
  const tokens_saved_vs_individual = Math.max(
    0,
    individual_execution_tokens - batch_execution_tokens
  );

  const row_ids_cleared: string[] = [];
  const lom_consensus_settlements: CronLomConsensusSettlement[] = [];

  if (!params.dryRun) {
    const clearedAt = new Date().toISOString();
    for (const task of params.tasks) {
      if (task.circuit_breaker_open) continue;
      if (!task.pillar_vector_id) continue;

      const instance = task.bug_index.level_1_1_1_instance;
      const strategy: ModularRemediationStrategy | null =
        remediationEngine.resolveAutoCronLomConsensusStrategy(instance);

      if (!strategy) {
        await recordRemediationFailure({
          admin: params.admin,
          tenantId: params.tenantId,
          filePath: task.file_path,
          bugIndex: task.bug_index,
          reason: `No remediation matrix strategies for ${instance}`,
          pillarVectorId: task.pillar_vector_id,
          source: "heal_queue_cron_batch",
        });
        continue;
      }

      const { data: row } = await fromPillarVectors(params.admin, params.tenantId)
        .select("metadata")
        .eq("id", task.pillar_vector_id)
        .maybeSingle();
      const prior = (row?.metadata ?? {}) as Record<string, unknown>;
      const {
        preset_interval: _removedPreset,
        heal_queue_pending: _removedPending,
        heal_queue_scheduled_at: _removedScheduledAt,
        scheduling_tier: _removedMetaTier,
        ...metaRest
      } = prior;

      const group = batch_plan.groups.find((g) => g.file_paths.includes(task.file_path));
      const entityId = entityIdFromTaskMetadata(params.tenantId, prior);
      const fixContent = buildRemediationFixTemplate(
        strategy.pillar,
        strategy.fix,
        strategy.consequence
      );

      try {
        await persistToVault({
          supabase: params.admin,
          entityId,
          tenantId: params.tenantId,
          content: fixContent,
          bugIndex: task.bug_index,
          summaryBeat: `Cron LOM consensus: ${strategy.label} (${task.file_path})`,
          legalVersion: "MSGF_V32",
          halScore: Math.max(0, Math.min(100, 100 - strategy.consequence_score)),
          actionType: "CRON_AUTO_LOM_CONSENSUS",
          narrativeExtra: {
            strategy_id: strategy.id,
            scope: strategy.scope,
            consequence_score: strategy.consequence_score,
            predicted_consequence: strategy.consequence,
            cron_auto_settled: true,
            heal_queue_cron_note: params.cronNote ?? "v32-heartbeat scheduled batch",
          },
        });

        await recordRemediationSuccess({
          admin: params.admin,
          tenantId: params.tenantId,
          filePath: task.file_path,
          bugIndex: task.bug_index,
          pillarVectorId: task.pillar_vector_id,
        });

        await fromPillarVectors(params.admin, params.tenantId)
          .update({
            scheduling_tier: null,
            remediation_state: REMEDIATION_STATE.RESOLVED,
            remediation_attempt_count: 0,
            metadata: {
              ...metaRest,
              heal_queue_pending: false,
              heal_queue_cron_cleared_at: clearedAt,
              heal_queue_last_cron_batch_at: clearedAt,
              heal_queue_cron_note: params.cronNote ?? "v32-heartbeat scheduled batch",
              remediation_failure_streak: 0,
              cron_lom_consensus_strategy_id: strategy.id,
              cron_lom_consensus_score: strategy.consequence_score,
              ledger: "vault",
              ...(group
                ? {
                    heal_queue_path_prefix: group.path_prefix,
                    heal_queue_strategy_id: group.strategy_id,
                  }
                : {}),
            },
          })
          .eq("id", task.pillar_vector_id);

        row_ids_cleared.push(task.pillar_vector_id);
        lom_consensus_settlements.push({
          file_path: task.file_path,
          strategy_id: strategy.id,
          consequence_score: strategy.consequence_score,
          ledger: "vault",
        });
      } catch (batchErr) {
        await recordRemediationFailure({
          admin: params.admin,
          tenantId: params.tenantId,
          filePath: task.file_path,
          bugIndex: task.bug_index,
          reason:
            batchErr instanceof Error
              ? batchErr.message
              : "scheduled batch LOM consensus persist failed",
          pillarVectorId: task.pillar_vector_id,
          source: "heal_queue_cron_batch",
        });
      }
    }
  } else {
    for (const task of params.tasks) {
      if (task.circuit_breaker_open) continue;
      const strategy = remediationEngine.resolveAutoCronLomConsensusStrategy(
        task.bug_index.level_1_1_1_instance
      );
      if (!strategy) continue;
      lom_consensus_settlements.push({
        file_path: task.file_path,
        strategy_id: strategy.id,
        consequence_score: strategy.consequence_score,
        ledger: "vault",
      });
    }
  }

  return {
    batch_plan,
    row_ids_cleared: params.dryRun ? [] : row_ids_cleared,
    lom_consensus_settlements,
    token_estimate: {
      individual_execution_tokens,
      batch_execution_tokens,
      tokens_saved_vs_individual,
    },
  };
}

/**
 * Process user-scheduled `preset_interval` rows for the current cron window.
 */
export async function runCronScheduledHealBatches(params: {
  admin: SupabaseClient;
  dryRun?: boolean;
  executedAt?: Date;
  periodHours?: number;
}): Promise<CronScheduledHealBatchResult> {
  const executedAt = params.executedAt ?? new Date();
  const periodHours = params.periodHours ?? V32_CRON_PERIOD_HOURS_DEFAULT;
  const dryRun = params.dryRun === true;

  const preset_intervals_due = presetIntervalsDueThisCronCycle({
    executedAt,
    periodHours,
  });

  const rows = await fetchScheduledPillarVectorsDueForCron(
    params.admin,
    preset_intervals_due
  );
  const byTenant = groupScheduledRowsByTenant(rows);

  const by_tenant: TenantCronHealSummary[] = [];
  let rows_healed = 0;
  let rows_cleared = 0;
  let individual_execution_tokens = 0;
  let batch_execution_tokens = 0;

  for (const [tenant_id, tenantRows] of byTenant) {
    const tasks = tenantRows
      .map(remediationTaskFromScheduledRow)
      .filter((t) => !t.circuit_breaker_open);
    const heal = await applyBulkHealForTasks({
      admin: params.admin,
      tenantId: tenant_id,
      tasks,
      dryRun,
      cronNote: `v32-heartbeat cron presets: ${preset_intervals_due.join(",")}`,
    });

    rows_healed += tasks.length;
    rows_cleared += heal.row_ids_cleared.length;
    individual_execution_tokens += heal.token_estimate.individual_execution_tokens;
    batch_execution_tokens += heal.token_estimate.batch_execution_tokens;

    by_tenant.push({
      tenant_id,
      task_count: tasks.length,
      row_ids_cleared: heal.row_ids_cleared,
      batch_plan: heal.batch_plan,
      token_estimate: heal.token_estimate,
    });
  }

  const tokens_saved_vs_individual = Math.max(
    0,
    individual_execution_tokens - batch_execution_tokens
  );

  const summary: CronScheduledHealBatchResult = {
    ok: true,
    protocol: "v3.2_cron_scheduled_heal_batch",
    executed_at: executedAt.toISOString(),
    dry_run: dryRun,
    cron_period_hours: periodHours,
    preset_intervals_due,
    rows_matched: rows.length,
    tenants_processed: by_tenant.length,
    rows_healed,
    rows_cleared,
    token_summary: {
      individual_execution_tokens,
      batch_execution_tokens,
      tokens_saved_vs_individual,
    },
    by_tenant,
  };

  console.info(
    "[v32-heartbeat] scheduled_heal_batch",
    JSON.stringify({
      dry_run: dryRun,
      preset_intervals_due,
      rows_matched: rows.length,
      tenants_processed: by_tenant.length,
      rows_cleared,
      tokens_saved_vs_individual,
    })
  );

  return summary;
}
