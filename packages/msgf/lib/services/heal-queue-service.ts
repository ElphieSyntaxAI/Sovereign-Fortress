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
 * Heal queue — list remediation tasks and execute BULK / INDIVIDUAL / SCHEDULED actions.
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildGenealogicalBugIndex,
  GenealogicalBugIndexSchema,
  PULSE_BUG_INDEX,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import type { MsgfGovernancePillar } from "@/lib/schemas/vault-hall-metadata";
import {
  type HealQueueHumanArbitrationBody,
  type HealQueuePresetInterval,
  type HumanArbitrationPackage,
  type IngestRemediationAction,
  type RemediationTask,
  PRESET_INTERVAL_TO_SCHEDULING_TIER,
  HumanArbitrationPackageSchema,
  RemediationTaskSchema,
} from "@/lib/schemas/heal-queue";
import { runArbitratePhase } from "@/lib/services/pulse-pipeline";
import { resolveHumanArbitrationAction } from "@/lib/services/pulse-pipeline/human-arbitration";
import { computeBrainReadiness } from "@/lib/services/brain-readiness";
import {
  buildIngestLineageForFile,
  pathToGenealogicalBugIndex,
  type IngestFile,
} from "@/lib/services/IngestService";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { applyPillarVectorsTenantFilter } from "@/lib/services/tenant-query-scope";
import type { BulkRemediationBatchPlan } from "@/lib/services/RemediationEngine";
import {
  applyBulkHealForTasks,
  type ApplyBulkHealResult,
} from "@/lib/services/heal-queue-cron-batch";
import {
  assertRemediationSchedulable,
  isCircuitBreakerTripped,
  recordRemediationFailure,
  recordRemediationSuccess,
  REMEDIATION_STATE,
} from "@/lib/services/remediation-retry-circuit";
import {
  bugIndexForGovernanceHeal,
  resolveHealIncidentProjectOrigin,
} from "@/lib/services/heal-incident-scope";
import { insertMsgfUserSentinelIncident } from "@/lib/services/msgf-incidents";
import { persistSelfHealReport } from "@/lib/services/self-heal-report";
import type { SelfHealReportBody } from "@/lib/schemas/diagnostic-snapshot";
import { buildTenantSentinelSelfHealBody } from "@/lib/services/tenant-sentinel-response";
import {
  buildHealActionTokenReport,
  buildHealQueueTokenSummary,
  filterTasksByHealCostTier,
  type HealQueueTokenSummary,
} from "@/lib/services/heal-token-estimate";
import { recommendDevHealPath } from "@/lib/dev-heal-config";
import { buildAgentContextPack } from "@/lib/services/agent-context-service";
import { fetchDevHandoffForTenant } from "@/lib/services/dev-handoff-service";

const BASELINE_GAP_BUG_INDEX = buildGenealogicalBugIndex({
  level_1_category: "1.0_PULSE",
  level_1_1_branch: "1.1_INGEST",
  level_1_1_1_instance: "1.1.1_HEAL_QUEUE_BASELINE",
});

function normalizeRelPath(p: string): string | null {
  const x = p.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!x || x.includes("..") || x.startsWith("/")) return null;
  return x;
}

function parseBugIndexFromMetadata(meta: Record<string, unknown> | null): GenealogicalBugIndex | null {
  if (!meta) return null;
  const raw = meta.bug_index;
  const parsed = GenealogicalBugIndexSchema.safeParse(raw);
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

function governancePillarFromMetadata(meta: Record<string, unknown> | null): MsgfGovernancePillar {
  const g = meta?.governance_pillar ?? meta?.pillar;
  if (g === "P1" || g === "P2" || g === "P3" || g === "P4" || g === "P5" || g === "P6") {
    return g;
  }
  return "P6";
}

function tasksFromBrainReadiness(
  tenantId: string,
  missing: MsgfGovernancePillar[],
  baselineTrainingRequired: boolean
): RemediationTask[] {
  const tasks: RemediationTask[] = [];

  for (const pillar of missing) {
    tasks.push(
      RemediationTaskSchema.parse({
        task_id: randomUUID(),
        file_path: `governance://baseline/${pillar}`,
        governance_pillar: pillar,
        bug_index: BASELINE_GAP_BUG_INDEX,
        reason: `Governance pillar ${pillar} baseline missing`,
        source: "brain_readiness",
        pillar_vector_id: null,
        scheduling_tier: null,
        preset_interval: null,
      })
    );
  }

  if (baselineTrainingRequired) {
    tasks.push(
      RemediationTaskSchema.parse({
        task_id: randomUUID(),
        file_path: "governance://baseline/training",
        governance_pillar: "P4",
        bug_index: PULSE_BUG_INDEX.userSentinelReport,
        reason: "Biometric baseline training required",
        source: "brain_readiness",
        pillar_vector_id: null,
        scheduling_tier: null,
        preset_interval: null,
      })
    );
  }

  return tasks;
}

async function fetchPillarVectorTasks(
  admin: SupabaseClient,
  tenantId: string
): Promise<RemediationTask[]> {
  type HealQueuePillarRow = {
    id: string;
    metadata: Record<string, unknown> | null;
    scheduling_tier: string | null;
    remediation_state: string | null;
    remediation_attempt_count: number | null;
  };
  type HealQueuePillarQuery = {
    limit: (n: number) => Promise<{
      data: HealQueuePillarRow[] | null;
      error: { message: string } | null;
    }>;
  };

  let query = fromPillarVectors(admin, tenantId).select(
    "id, metadata, scheduling_tier, remediation_state, remediation_attempt_count"
  ) as unknown as HealQueuePillarQuery;
  query = applyPillarVectorsTenantFilter(
    query as unknown as Parameters<typeof applyPillarVectorsTenantFilter>[0],
    tenantId
  ) as unknown as HealQueuePillarQuery;

  const { data, error } = await query.limit(500);
  if (error) {
    throw new Error(`pillar_vectors heal-queue scan failed: ${error.message}`);
  }

  const tasks: RemediationTask[] = [];

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const originalPath =
      typeof meta.original_path === "string"
        ? meta.original_path
        : typeof meta.file_path === "string"
          ? meta.file_path
          : null;

    const ledger = typeof meta.ledger === "string" ? meta.ledger : "";
    const schedulingTier =
      typeof row.scheduling_tier === "string"
        ? row.scheduling_tier
        : typeof meta.scheduling_tier === "string"
          ? meta.scheduling_tier
          : null;

    const presetRaw = meta.preset_interval;
    const preset_interval =
      presetRaw === "immediate" ||
      presetRaw === "1h" ||
      presetRaw === "6h" ||
      presetRaw === "nightly"
        ? presetRaw
        : null;

    const remediationState =
      typeof row.remediation_state === "string" ? row.remediation_state : null;
    const attemptCount = Number(row.remediation_attempt_count ?? 0);
    const circuitOpen = isCircuitBreakerTripped(remediationState);

    const needsHeal =
      ledger === "hall" ||
      meta.heal_queue_pending === true ||
      schedulingTier != null ||
      circuitOpen;

    if (!needsHeal && !originalPath) continue;

    const file_path = originalPath ?? `pillar-vector://${row.id}`;
    const bug_index =
      parseBugIndexFromMetadata(meta) ??
      (originalPath
        ? pathToGenealogicalBugIndex(originalPath)
        : PULSE_BUG_INDEX.hallConsensusFailed);

    const lineage = originalPath
      ? buildIngestLineageForFile({ path: originalPath, content: "" })
      : null;

    tasks.push(
      RemediationTaskSchema.parse({
        task_id: randomUUID(),
        file_path,
        governance_pillar: lineage?.governance_pillar ?? governancePillarFromMetadata(meta),
        bug_index: lineage?.bug_index ?? bug_index,
        reason: circuitOpen
          ? `Human arbitration required (${attemptCount} consecutive failures)`
          : ledger === "hall"
            ? "Hall ledger row requires remediation"
            : schedulingTier
              ? `Scheduled for ${schedulingTier} tier batch`
              : "Pillar vector flagged for heal queue",
        source: schedulingTier ? "scheduled" : "pillar_vector",
        pillar_vector_id: row.id as string,
        scheduling_tier:
          schedulingTier === "RED" || schedulingTier === "YELLOW" || schedulingTier === "GREEN"
            ? schedulingTier
            : null,
        preset_interval,
        remediation_state: remediationState as
          | "ACTIVE"
          | "SCHEDULED"
          | "PENDING_HUMAN_ARBITRATION"
          | "RESOLVED"
          | null,
        consecutive_failure_count: attemptCount,
        circuit_breaker_open: circuitOpen,
      })
    );
  }

  return tasks;
}

function enrichTasksWithTokenEstimates(
  tasks: RemediationTask[],
  summary: ReturnType<typeof buildHealQueueTokenSummary>
): RemediationTask[] {
  const byPath = new Map(summary.per_item.map((i) => [i.file_path, i]));
  return tasks.map((task) => {
    const est = byPath.get(task.file_path);
    if (!est) return task;
    return RemediationTaskSchema.parse({
      ...task,
      token_estimate: {
        file_path: est.file_path,
        cost_tier: est.cost_tier,
        strategy_scope: est.strategy_scope,
        consequence_score: est.consequence_score,
        tokens_without_msgf: est.tokens_without_msgf,
        tokens_with_msgf: est.tokens_with_msgf,
        tokens_saved: est.tokens_saved,
      },
    });
  });
}

export async function listHealQueueRemediationTasks(
  admin: SupabaseClient,
  tenantId: string,
  entityId: string
): Promise<{
  brain_readiness: Awaited<ReturnType<typeof computeBrainReadiness>>;
  remediation_tasks: RemediationTask[];
  human_arbitration_packages: HumanArbitrationPackage[];
  heal_token_summary: HealQueueTokenSummary;
}> {
  const brain = await computeBrainReadiness(admin, tenantId, entityId);
  const fromBrain = tasksFromBrainReadiness(
    tenantId,
    brain.missing_pillars,
    brain.baseline_training_required
  );
  const fromVectors = await fetchPillarVectorTasks(admin, tenantId);

  const seen = new Set<string>();
  const remediation_tasks: RemediationTask[] = [];

  for (const task of [...fromBrain, ...fromVectors]) {
    const key = `${task.file_path}:${task.bug_index.level_1_1_1_instance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    remediation_tasks.push(task);
  }

  const arbitrate = runArbitratePhase({ remediation_tasks });
  const human_arbitration_packages = arbitrate.pending_human_arbitration.map((pkg) =>
    HumanArbitrationPackageSchema.parse(pkg)
  );

  const heal_token_summary = buildHealQueueTokenSummary(remediation_tasks);
  const enriched_tasks = enrichTasksWithTokenEstimates(remediation_tasks, heal_token_summary);

  return {
    brain_readiness: brain,
    remediation_tasks: enriched_tasks,
    human_arbitration_packages,
    heal_token_summary,
  };
}

export async function executeHealQueueHumanArbitration(params: {
  admin: SupabaseClient;
  entityId: string;
  body: HealQueueHumanArbitrationBody;
}) {
  const { admin, entityId, body } = params;
  const tenantId = body.tenant_id;
  const filePath = body.file_path.replace(/\\/g, "/").replace(/^\.\/+/, "");

  const listed = await listHealQueueRemediationTasks(admin, tenantId, entityId);
  const task = listed.remediation_tasks.find((t) => t.file_path === filePath);

  if (!task?.circuit_breaker_open && task?.remediation_state !== "PENDING_HUMAN_ARBITRATION") {
    throw new Error(
      `No PENDING_HUMAN_ARBITRATION incident for ${filePath}. Circuit breaker is not open.`
    );
  }

  const bugIndex = task.bug_index;

  return resolveHumanArbitrationAction({
    admin,
    tenantId,
    entityId,
    filePath,
    bugIndex,
    action: body.action,
    pillarVectorId: task.pillar_vector_id,
    operatorNote: body.operator_note,
  });
}

function buildSelfHealBodyForPath(params: {
  tenantId: string;
  entityId: string;
  filePath: string;
  note: string;
}): SelfHealReportBody {
  return {
    captured_at: new Date().toISOString(),
    source: "heal_queue_individual",
    entity_id: params.entityId,
    tenant_id: params.tenantId,
    operator_note: params.note,
    editor: {
      location_href: params.filePath,
      tenant_id: params.tenantId,
    },
    keystrokes_last_10: [],
    pillar_health: {},
  };
}

export type HealQueuePostResult =
  | {
      ok: true;
      action_type: "BULK" | "BULK_EXPENSIVE" | "BULK_INEXPENSIVE";
      batch_plan: BulkRemediationBatchPlan;
      applied_count: number;
      healed_pillars: { pillar: string; label: string }[];
      token_estimate?: ApplyBulkHealResult["token_estimate"];
      token_usage_report?: ReturnType<typeof buildHealActionTokenReport>;
      row_ids_cleared?: string[];
    }
  | {
      ok: true;
      action_type: "INDIVIDUAL";
      results: Array<{
        file_path: string;
        ok: boolean;
        user_resume_message?: string;
        error?: string;
      }>;
      token_usage_report?: ReturnType<typeof buildHealActionTokenReport>;
    }
  | {
      ok: true;
      action_type: "SCHEDULED";
      scheduling_tier: string;
      preset_interval: HealQueuePresetInterval;
      updated_row_ids: string[];
      file_paths: string[];
    }
  | {
      ok: true;
      action_type: "DEV_CYCLE_START";
      dev_handoff: Awaited<ReturnType<typeof fetchDevHandoffForTenant>>;
      recommended_path: "self" | "cloud";
      remediation_task_count: number;
      agent_context: ReturnType<typeof buildAgentContextPack>;
    };

async function enqueueCircuitBreakerIncident(params: {
  admin: SupabaseClient;
  entityId: string;
  tenantId: string;
  filePath: string;
  bugIndex: GenealogicalBugIndex;
  governancePillar?: string | null;
  projectOrigin?: string;
  tenantKey?: string | null;
}) {
  const projectOrigin =
    params.projectOrigin ??
    resolveHealIncidentProjectOrigin({
      filePath: params.filePath,
      tenantKey: params.tenantKey,
    });

  await insertMsgfUserSentinelIncident({
    adminSupabase: params.admin,
    userId: params.entityId,
    scope: {
      tenantId: params.tenantId,
      entityId: params.entityId,
      projectOrigin,
    },
    bugIndex: bugIndexForGovernanceHeal({
      governancePillar: params.governancePillar,
      taskBugIndex: params.bugIndex,
    }),
    strategies: null,
  });
}

export async function executeHealQueueRemediation(params: {
  admin: SupabaseClient;
  entityId: string;
  body: IngestRemediationAction;
  tasksForBulk?: RemediationTask[];
  /** IDE `msgf.tenantKey` / `x-msgf-tenant-key` for project_origin on incidents. */
  tenantKey?: string | null;
}): Promise<HealQueuePostResult> {
  const { admin, entityId, body, tenantKey } = params;
  const tenantId = body.tenant_id;

  if (body.action_type === "DEV_CYCLE_START") {
    const listed = await listHealQueueRemediationTasks(admin, tenantId, entityId);
    const dev_handoff = await fetchDevHandoffForTenant(admin, tenantId);
    const recommended_path = recommendDevHealPath(dev_handoff);
    const brain_summary = `Brain ${listed.brain_readiness.readiness_score}%`;
    const agent_context = buildAgentContextPack({
      mode: "guided",
      tenant_id: tenantId,
      tasks: listed.remediation_tasks,
      file_paths: body.file_paths,
      brain_summary,
    });

    return {
      ok: true,
      action_type: "DEV_CYCLE_START",
      dev_handoff,
      recommended_path,
      remediation_task_count: listed.remediation_tasks.length,
      agent_context,
    };
  }

  if (
    body.action_type === "BULK" ||
    body.action_type === "BULK_EXPENSIVE" ||
    body.action_type === "BULK_INEXPENSIVE"
  ) {
    const listed = await listHealQueueRemediationTasks(admin, tenantId, entityId);

    if (listed.human_arbitration_packages.length > 0) {
      throw new Error(
        "BULK blocked: PENDING_HUMAN_ARBITRATION — resolve human arbitration before cloud batch heal."
      );
    }

    let tasks = (params.tasksForBulk ?? listed.remediation_tasks).filter(
      (t) => !t.circuit_breaker_open
    );

    if (body.action_type === "BULK_EXPENSIVE") {
      tasks = filterTasksByHealCostTier(tasks, "expensive");
    } else if (body.action_type === "BULK_INEXPENSIVE") {
      tasks = filterTasksByHealCostTier(tasks, "inexpensive");
    }

    const heal = await applyBulkHealForTasks({
      admin,
      tenantId,
      tasks,
      cronNote: `heal-queue ${body.action_type}`,
    });

    const healed_pillars = [
      ...new Set(tasks.map((t) => t.governance_pillar)),
    ].map((pillar) => ({ pillar, label: pillar }));

    const token_usage_report = buildHealActionTokenReport({
      tasks,
      batchTokenEstimate: heal.token_estimate,
    });

    return {
      ok: true,
      action_type: body.action_type,
      batch_plan: heal.batch_plan,
      applied_count: tasks.length,
      healed_pillars,
      token_estimate: heal.token_estimate,
      token_usage_report,
      row_ids_cleared: heal.row_ids_cleared,
    };
  }

  if (body.action_type === "INDIVIDUAL") {
    const paths = (body.file_paths ?? [])
      .map((p) => normalizeRelPath(p))
      .filter((p): p is string => Boolean(p));

    const results: Array<{
      file_path: string;
      ok: boolean;
      user_resume_message?: string;
      error?: string;
    }> = [];

    const listed = await listHealQueueRemediationTasks(admin, tenantId, entityId);

    for (const filePath of paths) {
      const task = listed.remediation_tasks.find((t) => t.file_path === filePath);
      if (task?.circuit_breaker_open) {
        results.push({
          file_path: filePath,
          ok: false,
          error: "PENDING_HUMAN_ARBITRATION — circuit breaker open; not re-queued.",
        });
        continue;
      }

      const bugIndex =
        task?.bug_index ??
        buildIngestLineageForFile({ path: filePath, content: "" }).bug_index;

      const projectOrigin = resolveHealIncidentProjectOrigin({
        filePath,
        tenantKey,
      });

      try {
        const report = await persistSelfHealReport({
          adminSupabase: admin,
          body: buildSelfHealBodyForPath({
            tenantId,
            entityId,
            filePath,
            note: `Heal queue INDIVIDUAL: ${filePath}`,
          }),
          entityId,
          tenantId,
          context: {
            projectOrigin,
            tenantKey,
            governancePillar: task?.governance_pillar,
            bugIndex,
          },
        });
        const ui = buildTenantSentinelSelfHealBody(report);

        const validationFailed =
          report.escalated_to_arbitrate === true ||
          (report.local_delta_applied === false && report.healed_pillars.length === 0);

        if (validationFailed) {
          const circuit = await recordRemediationFailure({
            admin,
            tenantId,
            filePath,
            bugIndex,
            reason: "INDIVIDUAL heal: consensus/validation did not resolve",
            pillarVectorId: task?.pillar_vector_id,
            source: "heal_queue_individual",
          });
          results.push({
            file_path: filePath,
            ok: false,
            error: circuit.tripped
              ? "PENDING_HUMAN_ARBITRATION — max consecutive failures exceeded."
              : ui.user_resume_message,
          });
          continue;
        }

        await recordRemediationSuccess({
          admin,
          tenantId,
          filePath,
          bugIndex,
          pillarVectorId: task?.pillar_vector_id,
        });

        results.push({
          file_path: filePath,
          ok: true,
          user_resume_message: ui.user_resume_message,
        });
      } catch (e) {
        const circuit = await recordRemediationFailure({
          admin,
          tenantId,
          filePath,
          bugIndex,
          reason: e instanceof Error ? e.message : "self-heal failed",
          pillarVectorId: task?.pillar_vector_id,
          source: "heal_queue_individual",
        });
        if (circuit.tripped) {
          await enqueueCircuitBreakerIncident({
            admin,
            entityId,
            tenantId,
            filePath,
            bugIndex,
            governancePillar: task?.governance_pillar,
            projectOrigin,
            tenantKey,
          });
        }
        results.push({
          file_path: filePath,
          ok: false,
          error: circuit.tripped
            ? "PENDING_HUMAN_ARBITRATION — max consecutive failures exceeded."
            : e instanceof Error
              ? e.message
              : "self-heal failed",
        });
      }
    }

    const selectedTasks = listed.remediation_tasks.filter((t) => paths.includes(t.file_path));
    const token_usage_report = buildHealActionTokenReport({ tasks: selectedTasks });

    return { ok: true, action_type: "INDIVIDUAL", results, token_usage_report };
  }

  const preset = body.preset_interval!;
  const scheduling_tier = PRESET_INTERVAL_TO_SCHEDULING_TIER[preset];
  const paths = (body.file_paths ?? [])
    .map((p) => normalizeRelPath(p))
    .filter((p): p is string => Boolean(p));

  const listed = await listHealQueueRemediationTasks(admin, tenantId, entityId);
  const updated_row_ids: string[] = [];

  for (const filePath of paths) {
    const existing = listed.remediation_tasks.find((t) => t.file_path === filePath);
    if (existing?.circuit_breaker_open) {
      throw new Error(
        `Cannot schedule ${filePath}: PENDING_HUMAN_ARBITRATION (circuit breaker).`
      );
    }
    assertRemediationSchedulable(existing?.remediation_state ?? null, filePath);

    const task =
      existing ??
      RemediationTaskSchema.parse({
        task_id: randomUUID(),
        file_path: filePath,
        governance_pillar: buildIngestLineageForFile({ path: filePath, content: "" })
          .governance_pillar,
        bug_index: pathToGenealogicalBugIndex(filePath),
        reason: "Scheduled via heal queue",
        source: "scheduled",
        pillar_vector_id: null,
        scheduling_tier,
        preset_interval: preset,
      });

    if (task.pillar_vector_id) {
      const { data: row } = await fromPillarVectors(admin, tenantId)
        .select("metadata")
        .eq("id", task.pillar_vector_id)
        .maybeSingle();
      const prior = (row?.metadata ?? {}) as Record<string, unknown>;
      const { error } = await fromPillarVectors(admin, tenantId)
        .update({
          scheduling_tier,
          remediation_state: REMEDIATION_STATE.SCHEDULED,
          remediation_attempt_count: 0,
          metadata: {
            ...prior,
            preset_interval: preset,
            heal_queue_scheduled_at: new Date().toISOString(),
            heal_queue_pending: true,
            file_path: filePath,
            bug_index: task.bug_index,
            governance_pillar: task.governance_pillar,
            remediation_failure_streak: 0,
          },
        })
        .eq("id", task.pillar_vector_id);

      if (error) {
        throw new Error(`Failed to schedule pillar_vector ${task.pillar_vector_id}: ${error.message}`);
      }
      updated_row_ids.push(task.pillar_vector_id);
    } else {
      const lineage = buildIngestLineageForFile({ path: filePath, content: "" } as IngestFile);
      const { data, error } = await fromPillarVectors(admin, tenantId)
        .insert({
          content: `Heal queue scheduled: ${filePath}`,
          remediation_state: REMEDIATION_STATE.SCHEDULED,
          remediation_attempt_count: 0,
          metadata: {
            tenant_id: tenantId,
            original_path: filePath,
            preset_interval: preset,
            heal_queue_scheduled_at: new Date().toISOString(),
            heal_queue_pending: true,
            scheduling_tier,
            bug_index: lineage.bug_index,
            governance_pillar: lineage.governance_pillar,
            ledger: "hall",
            ingest_source: "heal_queue",
            remediation_failure_streak: 0,
          },
          scheduling_tier,
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(`Failed to insert scheduled heal row: ${error.message}`);
      }
      if (data?.id) updated_row_ids.push(data.id as string);
    }
  }

  return {
    ok: true,
    action_type: "SCHEDULED",
    scheduling_tier,
    preset_interval: preset,
    updated_row_ids,
    file_paths: paths,
  };
}
