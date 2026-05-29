import * as vscode from "vscode";

import { readMsgfSettings, resolveEntityId, resolveTenantId } from "../config";
import { buildIdeApiAuthHeaders } from "../pulseAuth";

const LOG_PREFIX = "[MSGF Guard]";
const LAST_PACK_ID_KEY = "msgf.lastPackId";

type PromptOptimizerResponse = {
  ok?: boolean;
  packId?: string;
  markdown?: string;
  error?: string | Record<string, unknown>;
};

type ConfirmPackResponse = {
  ok?: boolean;
  error?: string;
  context_savings_tokens?: number;
  guided_sessions_24h?: number;
};

function apiBase(settings: ReturnType<typeof readMsgfSettings>): string {
  return settings.apiUrl.replace(/\/$/, "");
}

function activeEditorPaths(): string[] {
  const paths: string[] = [];
  const active = vscode.window.activeTextEditor;
  if (active) {
    const rel = vscode.workspace.asRelativePath(active.document.uri, false);
    if (rel && !rel.startsWith("..")) paths.push(rel.replace(/\\/g, "/"));
  }
  for (const uri of vscode.window.tabGroups.all.flatMap((g) =>
    g.tabs
      .map((t) => (t.input as { uri?: vscode.Uri })?.uri)
      .filter((u): u is vscode.Uri => u instanceof vscode.Uri)
  )) {
    const rel = vscode.workspace.asRelativePath(uri, false);
    if (rel && !rel.startsWith("..")) paths.push(rel.replace(/\\/g, "/"));
  }
  return [...new Set(paths)].slice(0, 32);
}

export async function runBuildTargetedPrompt(
  context: vscode.ExtensionContext
): Promise<void> {
  const settings = readMsgfSettings();
  const tenantId = resolveTenantId(settings);

  if (!settings.authToken?.trim()) {
    void vscode.window.showWarningMessage(
      `${LOG_PREFIX} msgf.authToken required — mint from Workspace → IDE setup.`
    );
    return;
  }

  if (!tenantId) {
    void vscode.window.showWarningMessage(`${LOG_PREFIX} msgf.tenantKey is required.`);
    return;
  }

  const userIntent = await vscode.window.showInputBox({
    title: "MSGF targeted prompt",
    prompt: "What feature or fix are you working on?",
    placeHolder: "e.g. Fix pillars 403 on wrong tenant key",
    ignoreFocusOut: true,
  });

  if (!userIntent?.trim()) return;

  const entityId = await resolveEntityId(context, settings);
  const url = `${apiBase(settings)}/api/msgf/prompt-optimizer`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildIdeApiAuthHeaders({ settings, tenantId, entityId }),
      },
      body: JSON.stringify({
        tenantKey: tenantId,
        userIntent: userIntent.trim(),
        activeFilePaths: activeEditorPaths(),
        goalType: "fix",
      }),
    });

    const data = (await res.json()) as PromptOptimizerResponse;
    if (!res.ok || !data.ok || !data.markdown) {
      const err =
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error ?? res.statusText);
      void vscode.window.showErrorMessage(`${LOG_PREFIX} Prompt optimizer failed: ${err}`);
      return;
    }

    if (data.packId) {
      await context.globalState.update(LAST_PACK_ID_KEY, data.packId);
    }

    await vscode.env.clipboard.writeText(data.markdown);
    void vscode.window.showInformationMessage(
      "🚀 Token-optimized prompt copied to clipboard! Paste into Cursor Composer."
    );
  } catch (e) {
    void vscode.window.showErrorMessage(
      `${LOG_PREFIX} ${e instanceof Error ? e.message : "Prompt optimizer network error"}`
    );
  }
}

export async function runConfirmPackUsed(
  context: vscode.ExtensionContext
): Promise<void> {
  const settings = readMsgfSettings();
  const tenantId = resolveTenantId(settings);
  const packId =
    (await context.globalState.get<string>(LAST_PACK_ID_KEY))?.trim() ||
    (
      await vscode.window.showInputBox({
        title: "MSGF confirm pack",
        prompt: "Pack ID from your last optimized prompt",
        ignoreFocusOut: true,
      })
    )?.trim();

  if (!packId || !tenantId || !settings.authToken?.trim()) {
    void vscode.window.showWarningMessage(
      `${LOG_PREFIX} Need packId, tenantKey, and msgf.authToken.`
    );
    return;
  }

  const entityId = await resolveEntityId(context, settings);
  const url = `${apiBase(settings)}/api/msgf/confirm-pack`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildIdeApiAuthHeaders({ settings, tenantId, entityId }),
      },
      body: JSON.stringify({ packId, tenantKey: tenantId }),
    });

    const data = (await res.json()) as ConfirmPackResponse;
    if (!res.ok || !data.ok) {
      void vscode.window.showErrorMessage(
        `${LOG_PREFIX} Confirm pack failed: ${data.error ?? res.statusText}`
      );
      return;
    }

    void vscode.window.showInformationMessage(
      `MSGF pack confirmed · context savings ~${data.context_savings_tokens ?? 0} tokens (24h sessions: ${data.guided_sessions_24h ?? "—"})`
    );
  } catch (e) {
    void vscode.window.showErrorMessage(
      `${LOG_PREFIX} ${e instanceof Error ? e.message : "Confirm pack network error"}`
    );
  }
}

export function registerOptimizerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.buildTargetedPrompt", () => {
      void runBuildTargetedPrompt(context);
    }),
    vscode.commands.registerCommand("msgf.confirmPackUsed", () => {
      void runConfirmPackUsed(context);
    })
  );
}
