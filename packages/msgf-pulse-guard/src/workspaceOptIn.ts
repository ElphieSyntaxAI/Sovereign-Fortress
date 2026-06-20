import * as vscode from "vscode";

import { isMsgfArmed, readMsgfSettings, settingsReady } from "./config";
import { getRepoRoot } from "./workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

const GLOBAL_SECRETS_WARN_KEY = "msgf.globalSecretsWarned";
const OPT_IN_STATE_KEY = "msgf.workspaceOptInState";
const OPT_IN_SESSION_KEY = "msgf.workspaceOptInAskedThisSession";

export const MSGF_ENABLE_CONFIRM_LABEL = "Enable for this file tree";

export type WorkspaceOptInState = "later" | "never";

function primaryFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

function optInStateKey(folder: vscode.WorkspaceFolder): string {
  return `${OPT_IN_STATE_KEY}:${folder.uri.toString()}`;
}

function folderDisplayLabel(folder: vscode.WorkspaceFolder): string {
  return folder.name || getRepoRoot() || "this folder";
}

function hasExplicitEnabledSetting(folder: vscode.WorkspaceFolder): boolean {
  const inspected = vscode.workspace.getConfiguration("msgf", folder.uri).inspect<boolean>("enabled");
  return (
    inspected?.workspaceFolderValue !== undefined || inspected?.workspaceValue !== undefined
  );
}

export async function setMsgfEnabledForWorkspace(
  enabled: boolean,
  folder: vscode.WorkspaceFolder = primaryFolder()!
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("msgf", folder.uri);
  await cfg.update("enabled", enabled, vscode.ConfigurationTarget.WorkspaceFolder);
}

function enableConfirmBody(label: string): string {
  return (
    `This will automatically enable MSGF for "${label}" — the file tree you have open now.\n\n` +
    `• Creates a .msgf/ folder in this project\n` +
    `• Buffers Pulse telemetry while you code\n` +
    `• Connects to the MSGF governance API\n\n` +
    `Other folders you open stay off unless you enable them separately. Use Cancel for client or personal repos.`
  );
}

async function offerSetupWizardAfterEnable(): Promise<void> {
  const ready = settingsReady(readMsgfSettings());
  if (ready.ok) return;
  const setup = await vscode.window.showInformationMessage(
    `${LOG_PREFIX} MSGF is on for this file tree. Paste your IDE token next?`,
    "Setup wizard",
    "Later"
  );
  if (setup === "Setup wizard") {
    void vscode.commands.executeCommand("msgf.runSetupWizard");
  }
}

/**
 * Modal confirmation — shared by status bar button, sidebar button, and first-open prompt.
 */
export async function confirmEnableMsgfForWorkspace(
  context: vscode.ExtensionContext,
  options?: { skipIfArmed?: boolean }
): Promise<boolean> {
  const folder = primaryFolder();
  if (!folder) {
    void vscode.window.showWarningMessage(`${LOG_PREFIX} Open a folder first.`);
    return false;
  }
  if (options?.skipIfArmed !== false && shouldArmGuard()) {
    void vscode.window.showInformationMessage(
      `${LOG_PREFIX} MSGF is already enabled for "${folderDisplayLabel(folder)}".`
    );
    return true;
  }

  const label = folderDisplayLabel(folder);
  const pick = await vscode.window.showWarningMessage(
    enableConfirmBody(label),
    { modal: true },
    MSGF_ENABLE_CONFIRM_LABEL,
    "Cancel"
  );

  if (pick !== MSGF_ENABLE_CONFIRM_LABEL) return false;

  await setMsgfEnabledForWorkspace(true, folder);
  await context.workspaceState.update(optInStateKey(folder), undefined);
  void vscode.window.showInformationMessage(
    `${LOG_PREFIX} MSGF enabled for "${label}". Setting up this file tree…`
  );
  await offerSetupWizardAfterEnable();
  return true;
}

export function registerWorkspaceOptInCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.confirmEnableForWorkspace", async () => {
      await confirmEnableMsgfForWorkspace(context, { skipIfArmed: false });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.enableForWorkspace", async () => {
      await confirmEnableMsgfForWorkspace(context, { skipIfArmed: false });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.disableForWorkspace", async () => {
      const folder = primaryFolder();
      if (!folder) return;
      await setMsgfEnabledForWorkspace(false, folder);
      await context.workspaceState.update(optInStateKey(folder), "never" satisfies WorkspaceOptInState);
      void vscode.window.showInformationMessage(
        `${LOG_PREFIX} MSGF disabled for "${folderDisplayLabel(folder)}" — no Pulse traffic or .msgf scaffold.`
      );
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.copyMsgfSettingsToWorkspace", async () => {
      const folder = primaryFolder();
      if (!folder) return;
      const cfg = vscode.workspace.getConfiguration("msgf", folder.uri);
      const keys = [
        "enabled",
        "apiUrl",
        "tenantKey",
        "authToken",
        "productPath",
        "devSession",
        "role",
        "licenseKey",
      ] as const;
      const patch: Record<string, string | boolean> = { "msgf.enabled": true };
      for (const key of keys) {
        const inspected = cfg.inspect<string | boolean>(key);
        const globalVal = inspected?.globalValue;
        const workspaceVal = inspected?.workspaceFolderValue ?? inspected?.workspaceValue;
        if (globalVal !== undefined && workspaceVal === undefined) {
          patch[`msgf.${key}`] = globalVal as string | boolean;
        }
      }
      const { mergeWorkspaceSettings } = await import("./ideSetupCommands.js");
      if (await mergeWorkspaceSettings(patch)) {
        void vscode.window.showInformationMessage(
          `${LOG_PREFIX} Copied msgf.* from User settings into this workspace. Remove them from User settings so client folders stay off.`
        );
      }
    })
  );
}

/**
 * Ask once per folder when MSGF is not configured — avoids arming client/personal repos silently.
 */
export async function promptWorkspaceOptIn(context: vscode.ExtensionContext): Promise<void> {
  const folder = primaryFolder();
  if (!folder) return;
  if (shouldArmGuard()) return;
  if (hasExplicitEnabledSetting(folder)) return;

  const dismissed = context.workspaceState.get<WorkspaceOptInState>(optInStateKey(folder));
  if (dismissed === "never") return;
  if (dismissed === "later" && context.workspaceState.get<boolean>(OPT_IN_SESSION_KEY)) return;

  const label = folderDisplayLabel(folder);

  const pick = await vscode.window.showInformationMessage(
    `MSGF is off for "${label}". Enable it for this file tree?`,
    { modal: true },
    MSGF_ENABLE_CONFIRM_LABEL,
    "Not now",
    "Don't ask for this folder"
  );

  await context.workspaceState.update(OPT_IN_SESSION_KEY, true);

  if (pick === MSGF_ENABLE_CONFIRM_LABEL) {
    await confirmEnableMsgfForWorkspace(context, { skipIfArmed: false });
    return;
  }

  if (pick === "Don't ask for this folder") {
    await context.workspaceState.update(optInStateKey(folder), "never");
    await setMsgfEnabledForWorkspace(false, folder);
    return;
  }

  if (pick === "Not now") {
    await context.workspaceState.update(optInStateKey(folder), "later");
  }
}

export async function warnIfMsgfSecretsAreGlobalOnly(
  context: vscode.ExtensionContext
): Promise<void> {
  if (shouldArmGuard()) return;
  if (context.globalState.get<boolean>(GLOBAL_SECRETS_WARN_KEY)) return;

  const folder = primaryFolder();
  if (!folder) return;

  const cfg = vscode.workspace.getConfiguration("msgf", folder.uri);
  const tokenInspect = cfg.inspect<string>("authToken");
  const globalToken = tokenInspect?.globalValue?.trim();
  const workspaceToken = (
    tokenInspect?.workspaceFolderValue ?? tokenInspect?.workspaceValue ?? ""
  ).trim();

  if (!globalToken || workspaceToken) return;

  await context.globalState.update(GLOBAL_SECRETS_WARN_KEY, true);

  const pick = await vscode.window.showWarningMessage(
    `${LOG_PREFIX} msgf.authToken is in User settings, so it applies to every folder you open (including client repos). Copy into this workspace only?`,
    "Copy to workspace",
    "Dismiss"
  );
  if (pick === "Copy to workspace") {
    await vscode.commands.executeCommand("msgf.copyMsgfSettingsToWorkspace");
  }
}

export function msgfDisabledHint(): string {
  return `${LOG_PREFIX} MSGF is off — click "$(shield) Enable MSGF" in the status bar or open the MSGF sidebar.`;
}

export function shouldArmGuard(): boolean {
  return isMsgfArmed(readMsgfSettings());
}
