import * as fs from "node:fs";

import * as vscode from "vscode";

import {
  getDevKitDir,
  getDevKitReadmePath,
  getWorkspaceRoot,
  initializeMsgfWorkspace,
  syncMsgfDevKit,
} from "./workspace/msgfWorkspace";

export function registerDevKitCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.openDevKit", () => {
      void openDevKitReadme(context);
    }),
    vscode.commands.registerCommand("msgf.syncDevKit", () => {
      void syncDevKitCommand(context);
    })
  );
}

async function openDevKitReadme(context: vscode.ExtensionContext): Promise<void> {
  await initializeMsgfWorkspace(context.extensionPath);
  const root = getWorkspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage("[MSGF] Open a workspace folder first.");
    return;
  }

  const readme = getDevKitReadmePath(root);
  const target = fsExists(readme) ? readme : pathToCookbook(root);
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function syncDevKitCommand(context: vscode.ExtensionContext): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage("[MSGF] Open a workspace folder first.");
    return;
  }

  const result = syncMsgfDevKit(context.extensionPath, root, { force: true });
  void vscode.window.showInformationMessage(
    `[MSGF] Developer kit synced (${result.copied} updated, ${result.skipped} unchanged).`
  );

  const pick = await vscode.window.showInformationMessage(
    "Open API cookbook?",
    "Open cookbook",
    "Dismiss"
  );
  if (pick === "Open cookbook") {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(pathToCookbook(root)));
    await vscode.window.showTextDocument(doc, { preview: false });
  }
}

function pathToCookbook(root: string): string {
  return `${getDevKitDir(root)}/api-cookbook.md`;
}

function fsExists(p: string): boolean {
  return fs.existsSync(p);
}
