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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
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
