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
 * Agent context packs — guided (0-token handoff) vs auto (compact task list).
 */

import type { RemediationTask } from "@/lib/schemas/heal-queue";
import { REPUTATION_PRUNE_THRESHOLD, resourceKeyForFile, resourceKeyForPack } from "@/lib/schemas/source-audit";

export type AgentContextMode = "guided" | "auto";

export type AgentContextBuildInput = {
  mode: AgentContextMode;
  tenant_id: string;
  tasks: RemediationTask[];
  file_paths?: string[];
  brain_summary?: string | null;
  trigger_label?: string | null;
  reputation?: Map<string, number>;
  packId?: string;
};

export type AgentContextBuildResult = {
  mode: AgentContextMode;
  markdown: string;
  task_count: number;
  tokens_estimate: {
    guided_chars: number;
    note: string;
  };
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function filterTasks(tasks: RemediationTask[], file_paths?: string[]): RemediationTask[] {
  if (!file_paths?.length) return tasks;
  const selected = new Set(file_paths.map(normalizePath));
  return tasks.filter((t) => selected.has(normalizePath(t.file_path)));
}

function pruneTasksByReputation(
  tasks: RemediationTask[],
  reputation?: Map<string, number>,
  packId?: string
): RemediationTask[] {
  if (!reputation || reputation.size === 0) return tasks;
  if (packId) {
    const packScore = reputation.get(resourceKeyForPack(packId));
    if (typeof packScore === "number" && packScore < REPUTATION_PRUNE_THRESHOLD) {
      return [];
    }
  }
  return tasks.filter((t) => {
    const score = reputation.get(resourceKeyForFile(t.file_path));
    return !(typeof score === "number" && score < REPUTATION_PRUNE_THRESHOLD);
  });
}

export function omitPrunedContextTasks(
  tasks: RemediationTask[],
  reputation: Map<string, number>,
  packId?: string
): RemediationTask[] {
  return pruneTasksByReputation(tasks, reputation, packId);
}

export function buildAgentContextPack(input: AgentContextBuildInput): AgentContextBuildResult {
  const tasks = pruneTasksByReputation(
    filterTasks(input.tasks, input.file_paths),
    input.reputation,
    input.packId
  );
  const lines: string[] = [
    "# MSGF agent context pack",
    "",
    `Mode: **${input.mode}** · Tenant: \`${input.tenant_id}\``,
  ];

  if (input.brain_summary?.trim()) {
    lines.push(`Brain: ${input.brain_summary.trim()}`);
  }
  if (input.trigger_label?.trim()) {
    lines.push(`Trigger: ${input.trigger_label.trim()}`);
  }

  if (input.mode === "auto") {
    lines.push("", "## Tasks (compact)", "");
    if (!tasks.length) {
      lines.push("- No remediation tasks in queue.");
    } else {
      for (const t of tasks) {
        lines.push(
          `- \`${t.file_path}\` · ${t.governance_pillar} · ${t.reason.slice(0, 120)}`
        );
      }
    }
    lines.push(
      "",
      "Fix each file with minimal diffs. Run project verify commands after edits."
    );
  } else {
    lines.push(
      "",
      "You are fixing code in the developer workspace. MSGF flagged the items below.",
      "Apply minimal correct edits. Run the appropriate build/lint/test for this repo after changes.",
      "",
      "## Files to fix (priority order)"
    );

    if (!tasks.length) {
      lines.push(
        "- No file tasks in queue. Run shadow scan or fix compile errors in the active file."
      );
    } else {
      for (const t of tasks) {
        lines.push(
          "",
          `### \`${t.file_path}\``,
          `- Pillar: **${t.governance_pillar}**`,
          `- Reason: ${t.reason}`,
          `- Bug index: \`${t.bug_index.level_1_category}.${t.bug_index.level_1_1_branch}.${t.bug_index.level_1_1_1_instance}\``,
          "",
          "Steps:",
          "1. Open this file in the workspace.",
          "2. Fix syntax, imports, and types so the file compiles.",
          "3. Preserve intended behavior; prefer small diffs.",
          "4. Ask one clarifying question before large refactors if unsure."
        );
      }
    }

    lines.push(
      "",
      "## Constraints",
      "- Do not modify `node_modules`, `.env`, or secrets.",
      "- Summarize changes and which verify command you ran.",
      ""
    );
  }

  const markdown = lines.join("\n");
  return {
    mode: input.mode,
    markdown,
    task_count: tasks.length,
    tokens_estimate: {
      guided_chars: markdown.length,
      note:
        input.mode === "guided"
          ? "Paste into your agent chat — no cloud heal tokens consumed."
          : "Compact list for agent batching.",
    },
  };
}
