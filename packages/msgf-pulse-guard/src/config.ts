import * as vscode from "vscode";

import { DEFAULT_MSGF_API_URL } from "./constants";
import { mergeMonorepoMsgfSettings } from "./nestedWorkspaceSettings";
import type { MsgfGuardSettings, SmallBrainProvider } from "./settingsTypes";
import { getRepoRoot } from "./workspace/msgfWorkspace";

export type { MsgfGuardSettings, SmallBrainProvider } from "./settingsTypes";

/** Strip stray quotes from pasted VS Code settings values. */
export function sanitizeMsgfSettingValue(value: string): string {
  let t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export function readMsgfSettings(): MsgfGuardSettings {
  const config = vscode.workspace.getConfiguration("msgf");
  const provider = config.get<string>("smallBrainProvider", "gemini");
  const normalizedProvider = (
    ["openai", "anthropic", "ollama", "deepseek", "gemini"] as const
  ).includes(provider as SmallBrainProvider)
    ? (provider as SmallBrainProvider)
    : "gemini";

  const authInspect = config.inspect<string>("authToken");
  const authFromConfig = sanitizeMsgfSettingValue(
    authInspect?.workspaceFolderValue ??
      authInspect?.workspaceValue ??
      authInspect?.globalValue ??
      config.get<string>("authToken", "")
  );

  const base: MsgfGuardSettings = {
    enabled: config.get<boolean>("enabled", false),
    productPath: sanitizeMsgfSettingValue(config.get<string>("productPath", "")),
    tenantKey: sanitizeMsgfSettingValue(config.get<string>("tenantKey", "")),
    authToken: authFromConfig,
    apiUrl: sanitizeMsgfSettingValue(config.get<string>("apiUrl", DEFAULT_MSGF_API_URL)),
    devSession: config.get<boolean>("devSession", false),
    role: config.get<string>("role", "").trim(),
    organizationId: config.get<string>("organizationId", "").trim(),
    licenseKey: config.get<string>("licenseKey", "").trim(),
    entityId: config.get<string>("entityId", "").trim(),
    smallBrainProvider: normalizedProvider,
    smallBrainApiKey: config.get<string>("smallBrainApiKey", "").trim(),
    smallBrainModelName: config.get<string>("smallBrainModelName", "").trim(),
  };

  return mergeMonorepoMsgfSettings(base, getRepoRoot());
}

export function resolveTenantId(settings: MsgfGuardSettings): string {
  if (settings.tenantKey.trim()) return settings.tenantKey.trim();
  return "";
}

export async function resolveEntityId(
  context: vscode.ExtensionContext,
  settings: MsgfGuardSettings
): Promise<string> {
  if (settings.entityId) return settings.entityId;
  const stored = context.globalState.get<string>("msgf.entityId");
  if (stored?.trim()) return stored.trim();
  const machineId = vscode.env.machineId.trim();
  await context.globalState.update("msgf.entityId", machineId);
  return machineId;
}

export function settingsReady(settings: MsgfGuardSettings): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!settings.apiUrl) {
    missing.push("msgf.apiUrl");
  }
  if (!settings.authToken.trim() && !settings.licenseKey.trim().startsWith("msgf_live_")) {
    missing.push("msgf.authToken");
  }
  if (!settings.tenantKey.trim()) {
    missing.push("msgf.tenantKey");
  }
  return { ok: missing.length === 0, missing };
}

/** MSGF arms only when this workspace opts in (`msgf.enabled`). */
export function isMsgfArmed(settings: MsgfGuardSettings): boolean {
  return settings.enabled === true;
}
