import type { HealConsoleTask } from "./healQueueTypes";

export type HealPromptContext = {
  tenantKey: string;
  apiUrl: string;
  triggerLabel?: string | null;
  brainSummary?: string | null;
  scanRuleErrors?: string[];
  pulseError?: string | null;
  healthError?: string | null;
  violationSummary?: string | null;
  tasks: HealConsoleTask[];
  /** Relative paths to emphasize (e.g. checked tasks); empty = all tasks */
  selectedPaths?: string[];
  workspaceFolderName?: string;
};

/**
 * Markdown prompt for Cursor / Claude Code / Chat — human-in-the-loop file repair
 * while MSGF cloud heal updates governance state.
 */
export function buildHealAgentPrompt(ctx: HealPromptContext): string {
  const selected = new Set(
    (ctx.selectedPaths ?? []).map((p) => p.replace(/\\/g, "/").replace(/^\.\/+/, ""))
  );
  const tasks =
    selected.size > 0
      ? ctx.tasks.filter((t) => selected.has(t.file_path.replace(/\\/g, "/").replace(/^\.\/+/, "")))
      : ctx.tasks;

  const lines: string[] = [
    "# MSGF remediation handoff",
    "",
    "You are fixing code in the developer's local workspace. MSGF (governance) flagged issues below.",
    "Apply minimal, correct edits. After changes, ensure the project builds (run the appropriate `tsc` / `npm test` / lint for this repo).",
    "",
    "## Context",
    `- Tenant: \`${ctx.tenantKey}\``,
    `- MSGF API: \`${ctx.apiUrl}\``,
  ];

  if (ctx.workspaceFolderName) {
    lines.push(`- Workspace folder: \`${ctx.workspaceFolderName}\``);
  }
  if (ctx.triggerLabel?.trim()) {
    lines.push(`- Trigger: ${ctx.triggerLabel.trim()}`);
  }
  if (ctx.brainSummary?.trim()) {
    lines.push(`- Brain: ${ctx.brainSummary.trim()}`);
  }

  lines.push("", "## Governance / scan signals");

  const signals = [
    ...(ctx.scanRuleErrors ?? []),
    ...(ctx.healthError ? [`Pillar health: ${ctx.healthError}`] : []),
    ...(ctx.pulseError ? [`Pulse: ${ctx.pulseError}`] : []),
    ...(ctx.violationSummary ? [`Violation: ${ctx.violationSummary}`] : []),
  ].filter(Boolean);

  if (signals.length) {
    for (const s of signals) {
      lines.push(`- ${s}`);
    }
  } else {
    lines.push("- (No extra scan errors — use remediation tasks below.)");
  }

  lines.push("", "## Files to fix (priority order)");

  if (!tasks.length) {
    lines.push(
      "- No file tasks in queue. Run **MSGF: Trigger Shadow Scan** in VS Code, or fix compile errors in the active file."
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
        "Tasks:",
        "1. Open this file in the workspace.",
        "2. Fix syntax, imports, and types so the file compiles.",
        "3. Preserve intended behavior; do not delete unrelated code.",
        "4. If unsure, ask one clarifying question before large refactors."
      );
    }
  }

  lines.push(
    "",
    "## Constraints",
    "- Do not modify `node_modules`, `.env`, or secrets.",
    "- Prefer small diffs over rewrites.",
    "- Summarize what you changed and which verify command you ran.",
    ""
  );

  return lines.join("\n");
}
