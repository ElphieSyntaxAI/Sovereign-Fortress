import * as vscode from "vscode";

import type { DevHandoffInfo } from "./healQueueTypes";

export type DevHealCycleChoice = "self_guided" | "self_local" | "cloud" | "cancel";

const CHOICES: Array<{
  id: DevHealCycleChoice;
  label: string;
  description: string;
}> = [
  {
    id: "self_guided",
    label: "Generate 0-token context pack (cloud)",
    description: "Fetch guided agent-context from MSGF and copy to clipboard.",
  },
  {
    id: "self_local",
    label: "Fix myself — local heal prompt",
    description: "Copy a markdown prompt built from the heal queue (no cloud heal).",
  },
  {
    id: "cloud",
    label: "Cloud heal (governance batch)",
    description: "Run Heal All — updates MSGF governance state (not local file patches).",
  },
];

export async function promptDevHealCycleChoice(
  devHandoff?: DevHandoffInfo | null
): Promise<DevHealCycleChoice> {
  const hint = devHandoff?.dev_cycle_required
    ? `Repeated incidents (${devHandoff.max_occurrence_count}/${devHandoff.threshold}) — prefer local fix first.`
    : "Choose how to remediate before cloud batch heal.";

  const pick = await vscode.window.showQuickPick(
    CHOICES.map((c) => ({
      label: c.label,
      description: c.description,
      detail: c.id === "cloud" ? "Uses tokens for governance batch" : undefined,
      id: c.id,
    })),
    {
      title: "MSGF dev heal cycle",
      placeHolder: hint,
      ignoreFocusOut: true,
    }
  );

  if (!pick || !("id" in pick)) return "cancel";
  return (pick as { id: DevHealCycleChoice }).id;
}
