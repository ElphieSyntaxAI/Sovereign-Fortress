/**
 * vscode:// deep link for one-click IDE setup (P4).
 */

import type { IdeWorkspaceSettings } from "@/lib/workspace-ide-setup";

/** Extension ID: publisher.name from msgf-pulse-guard/package.json */
export const MSGF_PULSE_GUARD_URI_AUTHORITY = "elphiesyntax.msgf-pulse-guard";

export function buildVscodeIdeSetupUri(settings: IdeWorkspaceSettings): string {
  const params = new URLSearchParams({
    apiUrl: settings["msgf.apiUrl"],
    tenantKey: settings["msgf.tenantKey"],
    authToken: settings["msgf.authToken"],
    role: settings["msgf.role"] ?? "dev",
  });
  if (settings["msgf.devSession"]) {
    params.set("devSession", "1");
  }
  if (settings["msgf.brainSensitivity"] != null) {
    params.set("brainSensitivity", String(settings["msgf.brainSensitivity"]));
  }
  return `vscode://${MSGF_PULSE_GUARD_URI_AUTHORITY}/setup?${params.toString()}`;
}
