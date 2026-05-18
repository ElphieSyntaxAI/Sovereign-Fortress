import * as vscode from "vscode";

import type { IdeStatusBarSnapshot } from "./ide-types";

export function formatStatusBarText(snapshot: IdeStatusBarSnapshot): string {
  const drift = snapshot.logicDriftLabel !== "—" ? snapshot.logicDriftLabel : "—";
  const tier = snapshot.defendTier ?? "—";
  const buf =
    snapshot.bufferedEventCount > 0 ? ` · buf ${snapshot.bufferedEventCount}` : "";
  return `$(shield) MSGF ${drift} · ${tier}${buf}`;
}

export function applyStatusBarTheme(
  item: vscode.StatusBarItem,
  snapshot: IdeStatusBarSnapshot
): void {
  if (snapshot.routing === "error") {
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    return;
  }
  if (snapshot.routing === "baseline_required" || snapshot.humanTiebreakerRequired) {
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    return;
  }
  item.backgroundColor = undefined;
}

export function formatStatusTooltip(
  snapshot: IdeStatusBarSnapshot,
  tenantId: string,
  apiUrl: string
): string {
  const lines = [
    "MSGF Pulse Guard (V3.2 IDE path)",
    `tenant: ${tenantId}`,
    `api: ${apiUrl}`,
    `routing: ${snapshot.routing}`,
    `logic drift: ${snapshot.logicDriftLabel}`,
    `defend: ${snapshot.defendTier ?? "—"}`,
    `buffered: ${snapshot.bufferedEventCount}`,
  ];
  if (snapshot.error) lines.push(`error: ${snapshot.error}`);
  return lines.join("\n");
}
