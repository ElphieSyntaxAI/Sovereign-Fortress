import * as vscode from "vscode";

import { readMsgfSettings } from "./config";
import { getUserGuidePath, getWorkspaceRoot, initializeMsgfWorkspace } from "./workspace/msgfWorkspace";

function baseApiUrl(): string {
  return readMsgfSettings().apiUrl.replace(/\/$/, "");
}

export function msgfSignInUrl(): string {
  return `${baseApiUrl()}/sign-in`;
}

export function msgfWorkspaceIdeSetupUrl(): string {
  return `${baseApiUrl()}/workspace#ide-setup`;
}

export async function openMsgfSignInBrowser(): Promise<void> {
  const url = msgfSignInUrl();
  const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
  if (!opened) {
    void vscode.window.showWarningMessage(
      "[MSGF] Could not open the browser. Sign in manually at: " + url
    );
    return;
  }
  void vscode.window.showInformationMessage(
    "[MSGF] Sign in in your browser (not the embedded panel). Then run “MSGF: Copy IDE token setup” or paste msgf.authToken from Workspace → IDE setup."
  );
}

export async function openMsgfWorkspaceIdeSetupBrowser(): Promise<void> {
  const url = msgfWorkspaceIdeSetupUrl();
  const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
  if (!opened) {
    void vscode.window.showWarningMessage("[MSGF] Open manually: " + url);
  }
}

export async function openMsgfUserGuide(context: vscode.ExtensionContext): Promise<void> {
  await initializeMsgfWorkspace(context.extensionPath);
  const root = getWorkspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage("[MSGF] Open a workspace folder first.");
    return;
  }
  const guidePath = getUserGuidePath(root);
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(guidePath));
  await vscode.window.showTextDocument(doc, { preview: false });
}

export function registerMsgfExternalAuthCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.openSignInBrowser", () => {
      void openMsgfSignInBrowser();
    }),
    vscode.commands.registerCommand("msgf.openWorkspaceIdeSetup", () => {
      void openMsgfWorkspaceIdeSetupBrowser();
    }),
    vscode.commands.registerCommand("msgf.openUserGuide", () => {
      void openMsgfUserGuide(context);
    })
  );
}
