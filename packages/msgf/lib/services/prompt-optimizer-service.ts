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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Structured V1 prompt optimizer — deterministic markdown, no LLM calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAgentContextPack } from "@/lib/services/agent-context-service";
import type { RemediationTask } from "@/lib/schemas/heal-queue";
import { listHealQueueRemediationTasks } from "@/lib/services/heal-queue-service";
import {
  mintPackId,
  registerPackInRedis,
  type PackRegistryRecord,
} from "@/lib/services/pack-registry";
import { lookupShadowScanShardsForPaths } from "@/lib/services/shadow-scan-shard-lookup";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";

export const PILLAR_6_CONSTRAINTS_BLOCK = [
  "## Pillar 6 constraints",
  "",
  "- Do **not** read, copy, or expose `.env`, credentials, API keys, or secrets.",
  "- Minimize unnecessary line churn — prefer small, reviewable diffs.",
  "- Preserve intended behavior; ask one clarifying question before large refactors.",
  "- Verify locally after edits (e.g. `npm run build`, `npm test`, or the project lint script).",
  "- Stay within the file scope and SWEEP boundaries listed below unless the user explicitly expands scope.",
  "",
].join("\n");

export type PromptOptimizerGoalType = "fix" | "feature" | "refactor";

export type BuildOptimizedPromptInput = {
  admin: SupabaseClient;
  tenantKey: string;
  userIntent: string;
  activeFilePaths: string[];
  goalType?: PromptOptimizerGoalType;
  entityId: string;
  userId?: string | null;
};

export type BuildOptimizedPromptResult = {
  packId: string;
  markdown: string;
  naiveCharCount: number;
  shardedCharCount: number;
  task_count: number;
  shadow_files_indexed: number;
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function isOpenHealTask(task: RemediationTask): boolean {
  if (task.circuit_breaker_open) return false;
  if (task.remediation_state === "PENDING_HUMAN_ARBITRATION") return false;
  return true;
}

function tasksForPaths(tasks: RemediationTask[], paths: string[]): RemediationTask[] {
  const open = tasks.filter(isOpenHealTask);
  if (!paths.length) return open;
  const selected = new Set(paths.map(normalizePath));
  const matched = open.filter((t) => selected.has(normalizePath(t.file_path)));
  return matched.length ? matched : open;
}

function intentMatchesTask(intent: string, task: RemediationTask): boolean {
  const needle = intent.toLowerCase();
  if (needle.length < 4) return true;
  const hay = `${task.file_path} ${task.reason} ${task.governance_pillar}`.toLowerCase();
  const tokens = needle.split(/\s+/).filter((w) => w.length > 3);
  return tokens.some((t) => hay.includes(t));
}

function filterTasksByIntent(tasks: RemediationTask[], intent: string): RemediationTask[] {
  const narrowed = tasks.filter((t) => intentMatchesTask(intent, t));
  return narrowed.length ? narrowed : tasks;
}

export function appendPackSignature(markdown: string, packId: string): string {
  const body = markdown.trimEnd();
  return `${body}\n\n<!-- MSGF-PACK:${packId} -->\n`;
}

export async function buildOptimizedPrompt(
  input: BuildOptimizedPromptInput
): Promise<BuildOptimizedPromptResult> {
  const tenantKey = sanitizeTenantScope(input.tenantKey);
  const paths = [...new Set(input.activeFilePaths.map(normalizePath).filter(Boolean))].slice(
    0,
    32
  );
  const goalType = input.goalType ?? "fix";
  const packId = mintPackId();

  const [shardLookup, listed] = await Promise.all([
    lookupShadowScanShardsForPaths(input.admin, tenantKey, paths),
    listHealQueueRemediationTasks(input.admin, tenantKey, input.entityId),
  ]);

  const scopedTasks = filterTasksByIntent(
    tasksForPaths(listed.remediation_tasks, paths),
    input.userIntent.trim()
  );

  const brain_summary = `Brain ${listed.brain_readiness.readiness_score}% · missing ${
    listed.brain_readiness.missing_pillars.join(", ") || "none"
  }`;

  const guided = buildAgentContextPack({
    mode: "guided",
    tenant_id: tenantKey,
    tasks: scopedTasks,
    file_paths: paths.length ? paths : undefined,
    brain_summary,
    trigger_label: `prompt-optimizer:${goalType}`,
  });

  const lines: string[] = [
    "# MSGF targeted agent prompt",
    "",
    `**Goal (${goalType}):** ${input.userIntent.trim()}`,
    "",
    brain_summary ? `**Brain:** ${brain_summary}` : "",
    "",
    "## Repository scope (SWEEP / P5 shards)",
    "",
  ];

  if (!shardLookup.files.length) {
    lines.push("- No active files supplied. Add editor focus or select paths before optimizing.");
  } else {
    for (const f of shardLookup.files) {
      lines.push(
        `### \`${f.file_path}\``,
        `- Boundary: ${f.boundary_summary}`,
        `- AST map (lightweight): ${f.ast_hints.join("; ")}`,
        f.governance_pillar ? `- Governance pillar: **${f.governance_pillar}**` : "",
        f.ingested_at ? `- Last SWEEP: ${f.ingested_at}` : "",
        ""
      );
    }
    lines.push(
      `- **Naive context (full files):** ${shardLookup.naive_char_total.toLocaleString()} chars`,
      `- **Sharded footprint (P5 cap):** ${shardLookup.sharded_char_total.toLocaleString()} chars`,
      ""
    );
  }

  lines.push("## Heal queue (open tasks)", "", guided.markdown);

  lines.push(PILLAR_6_CONSTRAINTS_BLOCK);

  lines.push(
    "## Agent instructions",
    "",
    "1. Work only in the scoped files unless the user expands scope.",
    "2. Implement the goal with minimal diffs aligned to heal-queue items.",
    "3. Run the appropriate verify command for this repo before finishing.",
    "4. Summarize files touched and commands run.",
    ""
  );

  const markdown = appendPackSignature(lines.filter(Boolean).join("\n"), packId);

  const naiveCharCount = shardLookup.naive_char_total || markdown.length;
  const shardedCharCount =
    shardLookup.sharded_char_total + Math.min(markdown.length, 12_000);

  const record: PackRegistryRecord = {
    packId,
    tenantKey,
    userIntent: input.userIntent.trim(),
    activeFilePaths: paths,
    naiveCharCount,
    shardedCharCount,
    entityId: input.entityId,
    userId: input.userId ?? null,
    createdAt: new Date().toISOString(),
  };

  await registerPackInRedis(record);

  return {
    packId,
    markdown,
    naiveCharCount,
    shardedCharCount,
    task_count: scopedTasks.length,
    shadow_files_indexed: shardLookup.files.filter((f) => f.naive_char_count > 0).length,
  };
}
