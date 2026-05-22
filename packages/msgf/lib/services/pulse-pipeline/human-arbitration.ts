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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import type { RemediationTask } from "@/lib/schemas/heal-queue";
import {
  buildRemediationFixTemplate,
  remediationEngine,
  toAdminIncidentStrategyDto,
  type ModularRemediationStrategy,
} from "@/lib/services/RemediationEngine";
import { REMEDIATION_STATE } from "@/lib/services/remediation-retry-circuit";
import { recordRemediationSuccess } from "@/lib/services/remediation-retry-circuit";
import { persistToVault, persistToHall } from "@/lib/services/constraint-ledger";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";

export type HumanArbitrationAction = "APPROVE_BYPASS" | "DENY_PURGE";

export type HumanArbitrationRecommendation = {
  strategy_id: string;
  scope: "global" | "local";
  pillar: string;
  label: string;
  recommended_code_fix: string;
  predicted_consequence: string;
  consequence_score: number;
  risk: string;
  rationale: string;
  apply_to_future_sessions: boolean;
};

export type HumanArbitrationComparisonPair = {
  label: string;
  left: HumanArbitrationRecommendation;
  right: HumanArbitrationRecommendation;
};

export type HumanArbitrationPackage = {
  file_path: string;
  bug_index: GenealogicalBugIndex;
  governance_pillar: string;
  remediation_state: typeof REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION;
  incident_summary: string;
  consecutive_failures: number;
  primary: HumanArbitrationRecommendation;
  alternatives: HumanArbitrationRecommendation[];
  comparison_pairs: HumanArbitrationComparisonPair[];
};

export type HumanArbitrationResolutionResult = {
  ok: true;
  action: HumanArbitrationAction;
  file_path: string;
  remediation_state: string;
  message: string;
  security_clean_signal: boolean;
};

function strategyToRecommendation(strategy: ModularRemediationStrategy): HumanArbitrationRecommendation {
  const dto = toAdminIncidentStrategyDto(strategy);
  return {
    strategy_id: strategy.id,
    scope: strategy.scope,
    pillar: strategy.pillar,
    label: strategy.label,
    recommended_code_fix: dto.fixTemplate,
    predicted_consequence: strategy.consequence,
    consequence_score: strategy.consequence_score,
    risk: strategy.risk,
    rationale: strategy.rationale,
    apply_to_future_sessions: strategy.apply_to_future_sessions,
  };
}

function synthesizeCodeFixForPath(filePath: string, strategy: ModularRemediationStrategy): string {
  const template = buildRemediationFixTemplate(strategy.pillar, strategy.fix, strategy.consequence);
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "ts";
  const comment = strategy.scope === "global" ? "GLOBAL" : "LOCAL";
  return [
    `// ${comment} remediation — ${strategy.label}`,
    `// Target: ${filePath}`,
    `// Predicted impact score: ${strategy.consequence_score}/100`,
    "",
    template,
    "",
    `// Apply operator-approved delta at: ${filePath}`,
  ].join("\n");
}

/**
 * Pull modular strategy matrix rows and build side-by-side comparison (global vs local).
 */
export function buildHumanArbitrationPackage(task: RemediationTask): HumanArbitrationPackage | null {
  if (!task.circuit_breaker_open && task.remediation_state !== REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION) {
    return null;
  }

  const instance = task.bug_index.level_1_1_1_instance;
  const strategies = remediationEngine.getModularStrategiesForIncident(instance);
  if (!strategies.length) return null;

  const globalStrategies = strategies.filter((s) => s.scope === "global");
  const localStrategies = strategies.filter((s) => s.scope === "local");
  const primaryStrategy = globalStrategies[0] ?? strategies[0];
  const alternateStrategy =
    localStrategies[0] ?? globalStrategies[1] ?? strategies[1] ?? primaryStrategy;

  const primary = strategyToRecommendation(primaryStrategy);
  primary.recommended_code_fix = synthesizeCodeFixForPath(task.file_path, primaryStrategy);

  const alternate = strategyToRecommendation(alternateStrategy);
  alternate.recommended_code_fix = synthesizeCodeFixForPath(task.file_path, alternateStrategy);

  const alternatives = strategies
    .filter((s) => s.id !== primaryStrategy.id)
    .map((s) => {
      const rec = strategyToRecommendation(s);
      rec.recommended_code_fix = synthesizeCodeFixForPath(task.file_path, s);
      return rec;
    })
    .slice(0, 4);

  const comparison_pairs: HumanArbitrationComparisonPair[] = [];
  if (primaryStrategy.id !== alternateStrategy.id) {
    comparison_pairs.push({
      label: "Global strategic fix vs local session fix",
      left: primary,
      right: alternate,
    });
  }

  for (let i = 0; i + 1 < alternatives.length; i += 2) {
    comparison_pairs.push({
      label: `Alternate path ${Math.floor(i / 2) + 1}`,
      left: alternatives[i],
      right: alternatives[i + 1],
    });
  }

  return {
    file_path: task.file_path,
    bug_index: task.bug_index,
    governance_pillar: task.governance_pillar,
    remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
    incident_summary: task.reason,
    consecutive_failures: task.consecutive_failure_count ?? 3,
    primary,
    alternatives,
    comparison_pairs,
  };
}

export function buildHumanArbitrationPackagesForTasks(
  tasks: readonly RemediationTask[]
): HumanArbitrationPackage[] {
  const packages: HumanArbitrationPackage[] = [];
  for (const task of tasks) {
    const pkg = buildHumanArbitrationPackage(task);
    if (pkg) packages.push(pkg);
  }
  return packages;
}

/**
 * Operator clears PENDING_HUMAN_ARBITRATION — APPROVE & BYPASS (Vault) or DENY & PURGE (Hall).
 */
export async function resolveHumanArbitrationAction(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityId: string;
  filePath: string;
  bugIndex: GenealogicalBugIndex;
  action: HumanArbitrationAction;
  pillarVectorId?: string | null;
  operatorNote?: string;
}): Promise<HumanArbitrationResolutionResult> {
  const note =
    params.operatorNote?.trim() ||
    `Human arbitration ${params.action} for ${params.filePath}`;

  if (params.action === "APPROVE_BYPASS") {
    await persistToVault({
      supabase: params.admin,
      entityId: params.entityId,
      tenantId: params.tenantId,
      content: note,
      bugIndex: params.bugIndex,
      summaryBeat: `Human APPROVE & BYPASS: ${params.filePath}`,
      legalVersion: "MSGF_V32",
      halScore: 85,
      actionType: "HUMAN_ARBITRATION_APPROVE",
    });

    await recordRemediationSuccess({
      admin: params.admin,
      tenantId: params.tenantId,
      filePath: params.filePath,
      bugIndex: params.bugIndex,
      pillarVectorId: params.pillarVectorId,
    });

    if (params.pillarVectorId) {
      await fromPillarVectors(params.admin, params.tenantId)
        .update({
          remediation_state: "RESOLVED",
          scheduling_tier: null,
          metadata: {
            heal_queue_pending: false,
            human_arbitration_cleared_at: new Date().toISOString(),
            human_arbitration_action: params.action,
          },
        })
        .eq("id", params.pillarVectorId);
    }

    return {
      ok: true,
      action: params.action,
      file_path: params.filePath,
      remediation_state: "RESOLVED",
      message: "APPROVE & BYPASS — Vault lineage advanced; circuit breaker cleared.",
      security_clean_signal: true,
    };
  }

  await persistToHall({
    supabase: params.admin,
    entityId: params.entityId,
    tenantId: params.tenantId,
    content: note,
    bugIndex: params.bugIndex,
    reason: `Human DENY & PURGE: operator rejected automated remediation for ${params.filePath}`,
    tier: "RED",
    actionType: "HUMAN_ARBITRATION_DENY",
  });

  if (params.pillarVectorId) {
    const { data: row } = await fromPillarVectors(params.admin, params.tenantId)
      .select("metadata")
      .eq("id", params.pillarVectorId)
      .maybeSingle();
    const prior = (row?.metadata ?? {}) as Record<string, unknown>;
    await fromPillarVectors(params.admin, params.tenantId)
      .update({
        remediation_state: "RESOLVED",
        scheduling_tier: null,
        metadata: {
          ...prior,
          heal_queue_pending: false,
          human_arbitration_action: params.action,
          human_arbitration_denied_at: new Date().toISOString(),
          ledger: "hall",
        },
      })
      .eq("id", params.pillarVectorId);
  }

  return {
    ok: true,
    action: params.action,
    file_path: params.filePath,
    remediation_state: "RESOLVED",
    message: "DENY & PURGE — Hall committed; automated queue will not re-schedule this path.",
    security_clean_signal: false,
  };
}
