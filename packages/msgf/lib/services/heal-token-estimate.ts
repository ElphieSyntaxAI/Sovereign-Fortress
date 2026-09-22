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
 * Heal-queue token estimates — naive per-file vs MSGF batch plan (not provider billing).
 */

import type { RemediationTask } from "@/lib/schemas/heal-queue";
import { remediationEngine } from "@/lib/services/RemediationEngine";
import {
  estimateBatchExecutionTokens,
  estimateIndividualExecutionTokens,
} from "@/lib/services/heal-queue-cron-batch";

export type HealCostTier = "expensive" | "inexpensive";

/** LLM overhead on top of path/context chars for a single heal execution. */
export const HEAL_EXPENSIVE_LLM_OVERHEAD =
  Number(process.env.MSGF_HEAL_EXPENSIVE_TOKEN_OVERHEAD?.trim()) || 1_000;
export const HEAL_INEXPENSIVE_LLM_OVERHEAD =
  Number(process.env.MSGF_HEAL_INEXPENSIVE_TOKEN_OVERHEAD?.trim()) || 220;

export type HealTaskTokenEstimate = {
  file_path: string;
  cost_tier: HealCostTier;
  strategy_scope: "global" | "local" | "unknown";
  consequence_score: number;
  tokens_without_msgf: number;
  tokens_with_msgf: number;
  tokens_saved: number;
};

export type HealQueueTokenSummary = {
  healable_item_count: number;
  expensive_count: number;
  inexpensive_count: number;
  arbitration_blocked_count: number;
  without_msgf_total: number;
  with_msgf_batch_total: number;
  tokens_saved_vs_naive: number;
  savings_pct: number;
  per_item: HealTaskTokenEstimate[];
  expensive_subset: {
    without_msgf_total: number;
    with_msgf_batch_total: number;
    tokens_saved: number;
  };
  inexpensive_subset: {
    without_msgf_total: number;
    with_msgf_batch_total: number;
    tokens_saved: number;
  };
};

export function classifyHealCostTier(bugIndexInstance: string): {
  tier: HealCostTier;
  scope: "global" | "local" | "unknown";
  consequence_score: number;
} {
  const strategy = remediationEngine.getPrimaryStrategyForIncident(bugIndexInstance);
  if (!strategy) {
    return { tier: "inexpensive", scope: "unknown", consequence_score: 0 };
  }
  const scope = strategy.scope === "global" ? "global" : "local";
  const expensive =
    scope === "global" ||
    strategy.consequence_score >= 40 ||
    strategy.risk === "High";
  return {
    tier: expensive ? "expensive" : "inexpensive",
    scope,
    consequence_score: strategy.consequence_score,
  };
}

export function estimateHealTaskIndividualTokens(
  filePath: string,
  tier: HealCostTier
): number {
  const pathTokens = estimateIndividualExecutionTokens([filePath]);
  const overhead =
    tier === "expensive" ? HEAL_EXPENSIVE_LLM_OVERHEAD : HEAL_INEXPENSIVE_LLM_OVERHEAD;
  return pathTokens + overhead;
}

function isHealEligibleTask(task: RemediationTask): boolean {
  return !task.circuit_breaker_open && task.remediation_state !== "PENDING_HUMAN_ARBITRATION";
}

export function buildHealQueueTokenSummary(tasks: readonly RemediationTask[]): HealQueueTokenSummary {
  const healable = tasks.filter(isHealEligibleTask);
  const arbitration_blocked_count = tasks.length - healable.length;

  const per_item: HealTaskTokenEstimate[] = healable.map((task) => {
    const { tier, scope, consequence_score } = classifyHealCostTier(
      task.bug_index.level_1_1_1_instance
    );
    const tokens_without_msgf = estimateHealTaskIndividualTokens(task.file_path, tier);
    return {
      file_path: task.file_path,
      cost_tier: tier,
      strategy_scope: scope,
      consequence_score,
      tokens_without_msgf,
      tokens_with_msgf: 0,
      tokens_saved: 0,
    };
  });

  const batchInput = healable.map((t) => ({
    file_path: t.file_path,
    bug_index_instance: t.bug_index.level_1_1_1_instance,
  }));
  const batchPlan =
    batchInput.length > 0 ? remediationEngine.buildBatchRemediationPlan(batchInput) : null;
  const with_msgf_batch_total = batchPlan
    ? estimateBatchExecutionTokens(batchPlan)
    : 0;

  if (per_item.length > 0 && with_msgf_batch_total > 0) {
    const naiveSum = per_item.reduce((s, i) => s + i.tokens_without_msgf, 0);
    let allocated = 0;
    for (let i = 0; i < per_item.length; i++) {
      const item = per_item[i]!;
      if (i === per_item.length - 1) {
        item.tokens_with_msgf = Math.max(0, with_msgf_batch_total - allocated);
      } else {
        const share = Math.floor(
          (item.tokens_without_msgf / naiveSum) * with_msgf_batch_total
        );
        item.tokens_with_msgf = share;
        allocated += share;
      }
      item.tokens_saved = Math.max(0, item.tokens_without_msgf - item.tokens_with_msgf);
    }
  }

  const without_msgf_total = per_item.reduce((s, i) => s + i.tokens_without_msgf, 0);
  const tokens_saved_vs_naive = Math.max(0, without_msgf_total - with_msgf_batch_total);
  const savings_pct =
    without_msgf_total > 0
      ? Math.round((tokens_saved_vs_naive / without_msgf_total) * 1000) / 10
      : 0;

  const expensiveItems = per_item.filter((i) => i.cost_tier === "expensive");
  const inexpensiveItems = per_item.filter((i) => i.cost_tier === "inexpensive");

  const subset = (items: HealTaskTokenEstimate[]) => {
    const without = items.reduce((s, i) => s + i.tokens_without_msgf, 0);
    const batchPlanSub =
      items.length > 0
        ? remediationEngine.buildBatchRemediationPlan(
            items.map((i) => {
              const task = healable.find((t) => t.file_path === i.file_path)!;
              return {
                file_path: task.file_path,
                bug_index_instance: task.bug_index.level_1_1_1_instance,
              };
            })
          )
        : null;
    const withBatch = batchPlanSub ? estimateBatchExecutionTokens(batchPlanSub) : 0;
    return {
      without_msgf_total: without,
      with_msgf_batch_total: withBatch,
      tokens_saved: Math.max(0, without - withBatch),
    };
  };

  return {
    healable_item_count: healable.length,
    expensive_count: expensiveItems.length,
    inexpensive_count: inexpensiveItems.length,
    arbitration_blocked_count,
    without_msgf_total,
    with_msgf_batch_total,
    tokens_saved_vs_naive,
    savings_pct,
    per_item,
    expensive_subset: subset(expensiveItems),
    inexpensive_subset: subset(inexpensiveItems),
  };
}

export function filterTasksByHealCostTier(
  tasks: readonly RemediationTask[],
  tier: HealCostTier
): RemediationTask[] {
  return tasks.filter((task) => {
    if (!isHealEligibleTask(task)) return false;
    const { tier: t } = classifyHealCostTier(task.bug_index.level_1_1_1_instance);
    return t === tier;
  });
}

export type HealActionTokenReport = {
  before_msgf_tokens: number;
  after_msgf_tokens: number;
  tokens_saved: number;
  savings_pct: number;
  items_targeted: number;
  note: string;
};

export function buildHealActionTokenReport(params: {
  tasks: readonly RemediationTask[];
  batchTokenEstimate?: {
    individual_execution_tokens: number;
    batch_execution_tokens: number;
    tokens_saved_vs_individual: number;
  } | null;
}): HealActionTokenReport {
  const summary = buildHealQueueTokenSummary(params.tasks);
  const targeted = params.tasks.filter(isHealEligibleTask);

  if (params.batchTokenEstimate) {
    const before = params.batchTokenEstimate.individual_execution_tokens;
    const after = params.batchTokenEstimate.batch_execution_tokens;
    const saved = params.batchTokenEstimate.tokens_saved_vs_individual;
    const savings_pct = before > 0 ? Math.round((saved / before) * 1000) / 10 : 0;
    return {
      before_msgf_tokens: before,
      after_msgf_tokens: after,
      tokens_saved: saved,
      savings_pct,
      items_targeted: targeted.length,
      note: "MSGF batch heal vs healing each file separately (estimated).",
    };
  }

  const before = summary.without_msgf_total;
  const after = summary.with_msgf_batch_total;
  return {
    before_msgf_tokens: before,
    after_msgf_tokens: after,
    tokens_saved: summary.tokens_saved_vs_naive,
    savings_pct: summary.savings_pct,
    items_targeted: targeted.length,
    note: "Estimated tokens if you ran separate heals vs MSGF grouped batch plan.",
  };
}

/** Pulse-style comparison copy for heal console banners. */
export function formatHealTokenNotice(report: HealActionTokenReport, phase: "before" | "after"): string {
  if (phase === "before") {
    return `Estimated ~${report.before_msgf_tokens.toLocaleString()} tokens without MSGF batching (${report.items_targeted} item${report.items_targeted === 1 ? "" : "s"}).`;
  }
  return `~${report.after_msgf_tokens.toLocaleString()} tokens with MSGF (~${report.tokens_saved.toLocaleString()} saved, ${report.savings_pct}%). ${report.note}`;
}
