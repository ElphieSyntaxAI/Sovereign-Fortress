import * as vscode from "vscode";

import { readMsgfSettings, resolveEntityId, resolveTenantId } from "../config";
import { executeSafeDiagnostic } from "../utils/terminal-interceptor";

const LOG_PREFIX = "[MSGF Guard]";
const PROGRESS_TITLE = "MSGF Safe Build diagnostic";

export async function runTerminalDiagnostic(
  context: vscode.ExtensionContext
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage(
      `${LOG_PREFIX} Open a workspace folder before running Safe Build.`
    );
    return;
  }

  const settings = readMsgfSettings();
  const tenantKey = resolveTenantId(settings);
  if (!tenantKey) {
    void vscode.window.showWarningMessage(`${LOG_PREFIX} msgf.tenantKey is required.`);
    return;
  }

  const workspacePath = folder.uri.fsPath;
  const entityId = await resolveEntityId(context, settings);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: PROGRESS_TITLE,
      cancellable: false,
    },
    async () => {
      await executeSafeDiagnostic(workspacePath, tenantKey, entityId);
    }
  );
}

export function registerTerminalDiagnosticCommand(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.runTerminalDiagnostic", () => {
      void runTerminalDiagnostic(context);
    })
  );
}
