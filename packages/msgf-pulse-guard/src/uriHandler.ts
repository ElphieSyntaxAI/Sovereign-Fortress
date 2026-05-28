import * as vscode from "vscode";

import { readMsgfSettings, sanitizeMsgfSettingValue } from "./config";
import { getWorkspaceRoot } from "./workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

/**
 * Handle vscode://elphiesyntax.msgf-pulse-guard/setup?apiUrl=...&tenantKey=...&authToken=...
 */
export function registerMsgfUriHandler(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): void {
        if (uri.path !== "/setup" && uri.path !== "setup") return;

        const params = new URLSearchParams(uri.query);
        const apiUrl = params.get("apiUrl")?.trim();
        const tenantKey = params.get("tenantKey")?.trim();
        const authToken = params.get("authToken")?.trim();

        if (!apiUrl || !tenantKey || !authToken) {
          void vscode.window.showErrorMessage(
            `${LOG_PREFIX} Deep link missing apiUrl, tenantKey, or authToken.`
          );
          return;
        }

        const cfg = vscode.workspace.getConfiguration("msgf");
        void cfg.update("apiUrl", sanitizeMsgfSettingValue(apiUrl), vscode.ConfigurationTarget.Workspace);
        void cfg.update(
          "tenantKey",
          sanitizeMsgfSettingValue(tenantKey),
          vscode.ConfigurationTarget.Workspace
        );
        void cfg.update(
          "authToken",
          sanitizeMsgfSettingValue(authToken),
          vscode.ConfigurationTarget.Workspace
        );

        if (params.get("devSession") === "1") {
          void cfg.update("devSession", true, vscode.ConfigurationTarget.Workspace);
        }

        const sensitivity = params.get("brainSensitivity");
        if (sensitivity) {
          const n = Number.parseFloat(sensitivity);
          if (Number.isFinite(n)) {
            void cfg.update("brainSensitivity", n, vscode.ConfigurationTarget.Workspace);
          }
        }

        void vscode.window
          .showInformationMessage(
            "MSGF settings applied from deep link. Reload the window to arm Pulse?",
            "Reload window"
          )
          .then((pick) => {
            if (pick === "Reload window") {
              void vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          });
      },
    })
  );
}

export async function registerWorkspaceWithMsgf(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const settings = readMsgfSettings();
  if (!settings.authToken?.trim() || !settings.apiUrl?.trim()) return;

  const folder = vscode.workspace.workspaceFolders?.[0]?.name ?? "workspace";
  const baseUrl = settings.apiUrl.replace(/\/$/, "");

  try {
    await fetch(`${baseUrl}/api/workspace/register-workspace`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspace_name: folder,
        workspace_path_hint: root,
      }),
    });
  } catch {
    /* non-fatal */
  }
}
