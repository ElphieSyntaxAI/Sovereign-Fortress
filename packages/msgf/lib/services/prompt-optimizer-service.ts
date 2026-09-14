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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Structured V1 prompt optimizer — deterministic markdown, no LLM calls.
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RemediationTask } from "@/lib/schemas/heal-queue";
import {
  buildFeatureVerifyScripts,
  formatAgentInstructionsSection,
  formatRunScriptsMarkdownSection,
  type FeatureVerifyScript,
} from "@/lib/services/feature-verify-scripts";
import { listHealQueueRemediationTasks } from "@/lib/services/heal-queue-service";
import {
  mintPackId,
  registerPackInRedis,
  type PackRegistryRecord,
} from "@/lib/services/pack-registry";
import { lookupShadowScanShardsForPaths } from "@/lib/services/shadow-scan-shard-lookup";
import {
  buildComposerAttachments,
  listSweepIngestIndex,
} from "@/lib/services/sweep-ingest-index";
import { listUserProjects, type UserProjectRow } from "@/lib/services/user-projects";
import { sanitizeTenantScope } from "@/lib/sanitize-tenant-scope";
import { isSafeRepoRelativePath } from "@/lib/utils/shell-safe-path";

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
  projectOrigin?: string | null;
};

export type BuildOptimizedPromptResult = {
  packId: string;
  markdown: string;
  naiveCharCount: number;
  shardedCharCount: number;
  task_count: number;
  shadow_files_indexed: number;
  verifyScripts: FeatureVerifyScript[];
  /** SHA-256 of markdown — attach as x-msgf-prompt-hash for fitness lineage. */
  prompt_hash: string;
};

export { buildFeatureVerifyScripts, type FeatureVerifyScript };

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

/** Drop absolute paths, junk labels, and out-of-repo tabs. */
export function sanitizeActiveFilePaths(paths: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const p = normalizePath(raw.trim());
    if (!p || seen.has(p)) continue;
    if (!isSafeRepoRelativePath(p)) continue;
    if (!p.includes(".") && !p.endsWith("Gemfile")) continue;
    seen.add(p);
    out.push(p);
  }
  return out.slice(0, 16);
}

function inferScopeHintsFromIntent(intent: string): string[] {
  const lower = intent.toLowerCase();
  const hints: string[] = [];
  if (/\bteam/.test(lower) && (/\btest/.test(lower) || /\bmembership/.test(lower))) {
    hints.push(
      "`test/controllers/teams_controller_test.rb`",
      "`app/controllers/teams_controller.rb`",
      "`app/models/team_membership.rb` (if present)"
    );
  }
  if (/\bmembership/.test(lower)) {
    hints.push("`app/models/team_membership.rb`", "`test/models/team_membership_test.rb`");
  }
  return [...new Set(hints)];
}

function inferVerifyCommandHint(paths: readonly string[]): string {
  const joined = paths.join(" ").toLowerCase();
  if (
    joined.includes(".rb") ||
    joined.includes("gemfile") ||
    joined.includes("app/controllers") ||
    joined.includes("test/")
  ) {
    const testFile = paths.find((p) => /test\/.*_test\.rb$/i.test(p));
    if (testFile) {
      return `\`bin/rails test ${testFile}\` (or \`bundle exec rails test ${testFile}\`)`;
    }
    return "`bin/rails test` (or `bundle exec rails test` for the affected files)";
  }
  if (joined.includes("package.json") || joined.includes(".tsx") || joined.includes(".ts")) {
    return "`npm test` / `npm run build`";
  }
  return "`npm test` or the project’s primary verify script";
}

function formatHealQueueSection(tasks: RemediationTask[]): string[] {
  const lines: string[] = ["## Heal queue (open tasks)", ""];
  if (!tasks.length) {
    lines.push(
      "- No open remediation tasks. Focus on the goal and scoped files above.",
      "- Run **MSGF shadow scan / SWEEP ingest** once so P5 boundaries populate for this repo."
    );
    return lines;
  }
  for (const t of tasks) {
    lines.push(
      `- \`${t.file_path}\` · **${t.governance_pillar}** — ${t.reason.slice(0, 160)}`
    );
  }
  return lines;
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

function formatMappedProjectsSection(
  projects: UserProjectRow[],
  tenantKey: string,
  projectOrigin: string | null
): string[] {
  const lines = ["## Mapped projects (Setup → Projects)", ""];
  const relevant = projects.filter(
    (p) =>
      p.project_origin === tenantKey ||
      (projectOrigin && p.project_origin === projectOrigin) ||
      p.project_origin.includes(tenantKey.split("/").pop() ?? "___")
  );
  const rows = relevant.length ? relevant : projects.slice(0, 5);
  if (!rows.length) {
    lines.push(
      `- No rows in **msgf_user_projects** for this account. Map the repo at Gated AI → Setup → Projects.`
    );
    return lines;
  }
  for (const p of rows) {
    lines.push(
      `- **${p.display_name}** · \`${p.project_origin}\`${p.local_path ? ` · local: \`${p.local_path}\`` : ""}`
    );
  }
  return lines;
}

export async function buildOptimizedPrompt(
  input: BuildOptimizedPromptInput
): Promise<BuildOptimizedPromptResult> {
  const tenantKey = sanitizeTenantScope(input.tenantKey);
  const projectOrigin = sanitizeTenantScope(
    input.projectOrigin?.trim() || input.tenantKey
  );
  let paths = sanitizeActiveFilePaths(input.activeFilePaths);
  const goalType = input.goalType ?? "fix";
  const packId = mintPackId();

  const [sweepIndex, mappedProjects] = await Promise.all([
    listSweepIngestIndex(input.admin, tenantKey, projectOrigin),
    input.userId
      ? listUserProjects(input.admin, input.userId).catch(() => [] as UserProjectRow[])
      : Promise.resolve([] as UserProjectRow[]),
  ]);

  if (!paths.length && sweepIndex.ingested_paths.length) {
    const intentLower = input.userIntent.toLowerCase();
    const tokens = intentLower.split(/\s+/).filter((w) => w.length > 3);
    const matched = sweepIndex.ingested_paths.filter((p) =>
      tokens.some((t) => p.toLowerCase().includes(t))
    );
    paths = sanitizeActiveFilePaths(matched.length ? matched : sweepIndex.ingested_paths.slice(0, 8));
  }

  const verifyHint = inferVerifyCommandHint(paths);
  const verifyScripts = buildFeatureVerifyScripts(input.userIntent.trim(), paths, packId);
  const intentHints = inferScopeHintsFromIntent(input.userIntent.trim());
  const composer = buildComposerAttachments(paths);

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

  const lines: string[] = [
    "# MSGF targeted agent prompt",
    "",
    `**Goal (${goalType}):** ${input.userIntent.trim()}`,
    "",
    `**Brain:** ${brain_summary}`,
    "",
    `**Mapped tenant / project_origin:** \`${projectOrigin}\``,
    "",
    ...formatMappedProjectsSection(mappedProjects, tenantKey, projectOrigin),
    "",
    "## Cursor Composer — attach (low token)",
    "",
    "Paste these **@** lines into Composer **before** the task body (accept each attachment):",
    "",
  ];

  if (composer.file_lines.length) {
    for (const line of composer.file_lines) lines.push(line);
  } else {
    lines.push("- _(no scoped files — open a target file and re-run)_");
  }
  if (composer.folder_lines.length) {
    lines.push("");
    lines.push("Folders (broader scope):");
    for (const line of composer.folder_lines) lines.push(line);
  }

  lines.push(
    "",
    "## Scoped files (workspace-relative)",
    ""
  );

  if (!paths.length) {
    lines.push("- No valid workspace files detected. Open the target file in **this** repo folder, then re-run the optimizer.");
  } else {
    for (const p of paths) {
      lines.push(`- \`${p}\``);
    }
  }

  if (intentHints.length) {
    lines.push("", "**Likely related paths** (confirm in repo):", "");
    for (const h of intentHints) {
      lines.push(`- ${h}`);
    }
  }

  lines.push("", "## SWEEP ingest index (cloud)", "");
  if (!sweepIndex.ingested_paths.length) {
    lines.push(
      "- No SWEEP shards for this tenant/origin yet. Run **MSGF → Trigger Shadow Scan** (include `.rb` / Rails files) or dashboard ingest."
    );
  } else {
    lines.push(
      `- **project_origin tags in index:** ${sweepIndex.project_origins.map((o) => `\`${o}\``).join(", ") || "—"}`,
      `- **Folder roots indexed:** ${sweepIndex.folder_roots.map((f) => `\`${f}\``).join(", ") || "—"}`,
      `- **Files indexed (sample):** ${Math.min(sweepIndex.ingested_paths.length, 12)} shown`,
      ""
    );
    for (const p of sweepIndex.ingested_paths.slice(0, 12)) {
      lines.push(`- \`${p}\``);
    }
    if (sweepIndex.ingested_paths.length > 12) {
      lines.push(`- _…and ${sweepIndex.ingested_paths.length - 12} more_`);
    }
    lines.push("");
  }

  lines.push("## Repository scope (SWEEP / P5 shards)", "");

  if (!shardLookup.files.length) {
    lines.push(
      "- No SWEEP index for these paths yet. Run shadow scan / ingest from the MSGF dashboard or IDE, then re-run the optimizer."
    );
  } else {
    const indexed = shardLookup.files.filter((f) => f.naive_char_count > 0);
    if (!indexed.length) {
      lines.push(
        "- Scoped files are not in the SWEEP cache yet. Re-run shadow scan with **msgf.tenantKey** as project_origin (v0.1.3+) and Ruby globs enabled."
      );
    }
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

  lines.push(...formatHealQueueSection(scopedTasks));

  lines.push(...formatRunScriptsMarkdownSection(verifyScripts));

  lines.push(PILLAR_6_CONSTRAINTS_BLOCK);

  lines.push(
    ...formatAgentInstructionsSection({
      userIntent: input.userIntent.trim(),
      paths,
      verifyScripts,
      verifyHint,
    })
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
    verifyScripts,
    prompt_hash: createHash("sha256").update(markdown, "utf8").digest("hex"),
  };
}
