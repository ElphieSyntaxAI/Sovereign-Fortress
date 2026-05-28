import * as vscode from "vscode";

import { DEFAULT_MSGF_API_URL } from "./constants";

export type SmallBrainProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "deepseek"
  | "gemini";

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

export type MsgfGuardSettings = {
  tenantKey: string;
  authToken: string;
  apiUrl: string;
  /**
   * Vibe-coding profile: buffer edits locally; POST /api/msgf/pulse on file save (not every 3s).
   */
  devSession: boolean;
  /** V3.2 tier: `global_admin` | `company_admin` | `dev` */
  role: string;
  /** Team / company silo; when empty, sandbox fallback may apply. */
  organizationId: string;
  licenseKey: string;
  entityId: string;
  smallBrainProvider: SmallBrainProvider;
  smallBrainApiKey: string;
  smallBrainModelName: string;
};

export function readMsgfSettings(): MsgfGuardSettings {
  const config = vscode.workspace.getConfiguration("msgf");
  const provider = config.get<string>("smallBrainProvider", "gemini");
  const normalizedProvider = (
    ["openai", "anthropic", "ollama", "deepseek", "gemini"] as const
  ).includes(provider as SmallBrainProvider)
    ? (provider as SmallBrainProvider)
    : "gemini";

  return {
    tenantKey: sanitizeMsgfSettingValue(config.get<string>("tenantKey", "")),
    authToken: sanitizeMsgfSettingValue(config.get<string>("authToken", "")),
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
}

export function resolveTenantId(settings: MsgfGuardSettings): string {
  if (settings.tenantKey) return settings.tenantKey;
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.name?.trim() || "workspace";
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
  return { ok: missing.length === 0, missing };
}
