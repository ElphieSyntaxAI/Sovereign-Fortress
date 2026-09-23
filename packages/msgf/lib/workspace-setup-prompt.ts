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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import {
  buildIdeWorkspaceSettings,
  formatIdeSettingsJson,
} from "@/lib/workspace-ide-setup";

const DEFAULT_API_ORIGIN = "https://elphiesgatedai.elphiesyntax.com";

export function buildWorkspaceSetupPrompt(input: {
  tenantKey: string;
  apiUrl?: string;
  existingOrigins?: string[];
}): string {
  const tenantKey = input.tenantKey.trim();
  const apiUrl = (input.apiUrl?.trim() || DEFAULT_API_ORIGIN).replace(/\/$/, "");
  const origins = (input.existingOrigins ?? []).map((origin) => origin.trim()).filter(Boolean);
  const sample = formatIdeSettingsJson(
    buildIdeWorkspaceSettings({
      apiUrl,
      tenantKey,
      authToken: "msgf_ide_PASTE_LONG_LIVED_TOKEN",
      productPath: "apps/billing",
    })
  );

  const mapped = origins.length ? origins.map((origin) => `- ${origin}`).join("\n") : "- (none)";

  return [
    "Set up MSGF in this repository.",
    `Tenant key: ${tenantKey}`,
    `API URL: ${apiUrl}`,
    "Do not invent a second tenant.",
    "",
    "Map one project origin per app. Do not register the monorepo root as the only project.",
    "Several git roots in this folder: one origin per repository.",
    "One git root with workspaces (packages/*, apps/*, pnpm, or turbo): one origin per deployable app. Skip shared libraries.",
    "Origin shape is owner/name or a short path such as apps/billing.",
    "Skip origins already mapped. If Workspace returns Already mapped, leave that row alone.",
    "Already mapped:",
    mapped,
    "",
    "After I confirm the table (name, origin, path), I will add each new row with Add Project on Workspace Projects.",
    "",
    "Activate Pulse Guard in this order:",
    "1. Download msgf-pulse-guard.vsix from /api/downloads/pulse-guard and install it with Extensions → Install from VSIX.",
    "2. For each origin, mint the long-lived msgf_ide_* token on the Projects tab. Do not paste the browser JWT.",
    "3. Write .vscode/settings.json with msgf.enabled true. When the editor root is the app, omit a parent productPath. When the root is the monorepo, set msgf.productPath to that app folder.",
    "Settings shape:",
    sample,
    "",
    "Keep these names: Vault, Hall, Pulse Guard, Intercept Gateway, Active Cache, Small Brain, Big Brain.",
    "Do not add Author, Syntax Educates, Cursor MCP, or a raw database export.",
  ].join("\n");
}
