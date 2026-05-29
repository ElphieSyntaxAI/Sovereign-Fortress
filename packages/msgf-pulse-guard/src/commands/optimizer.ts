import * as vscode from "vscode";

import { readMsgfSettings, resolveEntityId, resolveTenantId } from "../config";
import { buildIdeApiAuthHeaders } from "../pulseAuth";
import { collectOptimizerScopePaths } from "../optimizerScopePaths";
import { inferLocalVerifyScripts, registerRunScripts } from "../utils/run-scripts-store";

const LOG_PREFIX = "[MSGF Guard]";
const LAST_PACK_ID_KEY = "msgf.lastPackId";

type VerifyScriptPayload = {
  id: string;
  label: string;
  command: string;
};

type PromptOptimizerResponse = {
  ok?: boolean;
  packId?: string;
  markdown?: string;
  verifyScripts?: VerifyScriptPayload[];
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

function formatOptimizerError(
  res: Response,
  data: PromptOptimizerResponse
): string {
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (data.error && typeof data.error === "object") {
    const errObj = data.error as Record<string, unknown>;
    const form = errObj._form ?? errObj.formErrors;
    if (Array.isArray(form) && form.length) {
      return form.map(String).join("; ");
    }
    const parts = Object.entries(errObj)
      .filter(([k, v]) => k !== "_form" && k !== "formErrors" && v != null)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    if (parts.length) return parts.join("; ");
  }
  if (!data.ok && !data.markdown?.trim()) {
    return `HTTP ${res.status} — no markdown returned (API may need redeploy).`;
  }
  return res.statusText || `HTTP ${res.status}`;
}

export type BuildTargetedPromptResult =
  | { ok: true; packId?: string; runScriptsCount: number }
  | { ok: false; error: string };

/** Run prompt optimizer with a caller-supplied intent (sidebar form or palette). */
export async function buildTargetedPromptWithIntent(
  context: vscode.ExtensionContext,
  userIntent: string
): Promise<BuildTargetedPromptResult> {
  const settings = readMsgfSettings();
  const tenantId = resolveTenantId(settings);
  const intent = userIntent.trim();

  if (!settings.authToken?.trim()) {
    return {
      ok: false,
      error: `${LOG_PREFIX} msgf.authToken required — mint from Workspace → IDE setup.`,
    };
  }

  if (!tenantId) {
    return { ok: false, error: `${LOG_PREFIX} msgf.tenantKey is required.` };
  }

  if (intent.length < 3) {
    return { ok: false, error: "Describe what you are building or fixing (at least 3 characters)." };
  }

  const activeFilePaths = await collectOptimizerScopePaths(intent);
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
        userIntent: intent,
        activeFilePaths,
        goalType: "fix",
      }),
    });

    const data = (await res.json()) as PromptOptimizerResponse;
    if (!res.ok || !data.ok || !data.markdown?.trim()) {
      return { ok: false, error: formatOptimizerError(res, data) };
    }

    if (data.packId) {
      await context.globalState.update(LAST_PACK_ID_KEY, data.packId);
    }

    let runScriptsCount = 0;
    if (data.verifyScripts?.length) {
      runScriptsCount = registerRunScripts(data.verifyScripts, {
        packId: data.packId,
        userIntent: intent,
      }).length;
    } else {
      runScriptsCount = inferLocalVerifyScripts(intent, activeFilePaths, data.packId).length;
    }

    await vscode.env.clipboard.writeText(data.markdown);
    return { ok: true, packId: data.packId, runScriptsCount };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Prompt optimizer network error",
    };
  }
}

export async function runBuildTargetedPrompt(
  context: vscode.ExtensionContext
): Promise<void> {
  const userIntent = await vscode.window.showInputBox({
    title: "MSGF targeted prompt",
    prompt: "What feature or fix are you working on?",
    placeHolder: "e.g. Fix pillars 403 on wrong tenant key",
    ignoreFocusOut: true,
  });

  if (!userIntent?.trim()) return;

  const result = await buildTargetedPromptWithIntent(context, userIntent);
  if (!result.ok) {
    void vscode.window.showErrorMessage(`${LOG_PREFIX} Prompt optimizer failed: ${result.error}`);
    return;
  }

  void vscode.window.showInformationMessage(
    `🚀 Token-optimized prompt copied! ${result.runScriptsCount} verify script(s) added to Run Scripts.`
  );
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
