import * as fs from "fs";
import * as path from "path";

import * as vscode from "vscode";

import { fetchConnectivityCheck } from "./connectivityCheckClient";
import { readMsgfSettings, sanitizeMsgfSettingValue, settingsReady } from "./config";
import { openMsgfWorkspaceIdeSetupBrowser } from "./openMsgfExternal";
import { getRepoRoot } from "./workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

type SettingsJson = Record<string, unknown>;

function parseSettingsJson(text: string): SettingsJson | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SettingsJson;
    }
  } catch {
    return null;
  }
  return null;
}

export async function mergeWorkspaceSettings(merge: SettingsJson): Promise<boolean> {
  const root = getRepoRoot();
  if (!root) {
    void vscode.window.showWarningMessage(`${LOG_PREFIX} Open a workspace folder first.`);
    return false;
  }

  const vscodeDir = path.join(root, ".vscode");
  const settingsPath = path.join(vscodeDir, "settings.json");

  let existing: SettingsJson = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, "utf8");
    existing = parseSettingsJson(raw) ?? {};
  } else {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  const next = { ...existing, ...merge };
  fs.writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  const cfg = vscode.workspace.getConfiguration("msgf");
  for (const [key, value] of Object.entries(merge)) {
    if (!key.startsWith("msgf.")) continue;
    const short = key.replace(/^msgf\./, "");
    if (typeof value === "string") {
      await cfg.update(short, value, vscode.ConfigurationTarget.Workspace);
    } else if (typeof value === "boolean" || typeof value === "number") {
      await cfg.update(short, value, vscode.ConfigurationTarget.Workspace);
    }
  }

  return true;
}

export async function applyWorkspaceSettingsFromClipboard(): Promise<void> {
  const clip = await vscode.env.clipboard.readText();
  const parsed = parseSettingsJson(clip);
  if (!parsed) {
    void vscode.window.showErrorMessage(
      `${LOG_PREFIX} Clipboard does not contain valid JSON. Copy the block from Workspace → IDE setup.`
    );
    return;
  }

  const msgfKeys = Object.keys(parsed).filter((k) => k.startsWith("msgf."));
  if (!msgfKeys.length) {
    void vscode.window.showErrorMessage(`${LOG_PREFIX} No msgf.* keys found in clipboard JSON.`);
    return;
  }

  const merge: SettingsJson = {};
  for (const k of msgfKeys) {
    const v = parsed[k];
    if (typeof v === "string") {
      merge[k] = sanitizeMsgfSettingValue(v);
    } else {
      merge[k] = v;
    }
  }

  if (await mergeWorkspaceSettings(merge)) {
    void vscode.window.showInformationMessage(
      `${LOG_PREFIX} Applied ${msgfKeys.length} MSGF setting(s) to .vscode/settings.json. Reload the window, then run MSGF: Test connection.`
    );
  }
}

export async function runTestConnection(context: vscode.ExtensionContext): Promise<void> {
  const ready = settingsReady(readMsgfSettings());
  if (!ready.ok) {
    const pick = await vscode.window.showWarningMessage(
      `${LOG_PREFIX} Settings incomplete (${ready.missing.join(", ")}). Open IDE setup in browser?`,
      "Open IDE setup",
      "Cancel"
    );
    if (pick === "Open IDE setup") {
      await openMsgfWorkspaceIdeSetupBrowser();
    }
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "MSGF: Testing connection…",
      cancellable: false,
    },
    async () => {
      const result = await fetchConnectivityCheck({ context });
      if ("error" in result && !result.checks) {
        void vscode.window.showErrorMessage(`${LOG_PREFIX} ${result.error}`);
        return;
      }

      const failed = result.checks.filter((c) => !c.ok);
      if (result.ok && failed.length === 0) {
        void vscode.window.showInformationMessage(
          `${LOG_PREFIX} All checks passed. Pulse and pillar health should work.`
        );
        return;
      }

      const lines = failed
        .map((c) => `• ${c.name}: ${c.user_message ?? "failed"}${c.error_code ? ` [${c.error_code}]` : ""}`)
        .join("\n");
      const detail = new vscode.MarkdownString(
        `**MSGF connection issues**\n\n${lines}\n\nRun **MSGF: Open IDE token setup (browser)** to refresh your token.`
      );
      void vscode.window.showErrorMessage(`${LOG_PREFIX} Connection check failed`, "Open IDE setup").then(
        (pick) => {
          if (pick === "Open IDE setup") void openMsgfWorkspaceIdeSetupBrowser();
        }
      );
      console.warn(`${LOG_PREFIX} connectivity-check`, result);
    }
  );
}

export async function runSetupWizard(context: vscode.ExtensionContext): Promise<void> {
  const step = await vscode.window.showQuickPick(
    [
      { label: "Open IDE token setup in browser", step: "browser" as const },
      { label: "Apply settings from clipboard (after copy from web)", step: "apply" as const },
      { label: "Test connection to MSGF API", step: "test" as const },
    ],
    { title: "MSGF setup wizard", placeHolder: "Choose a step" }
  );
  if (!step) return;

  if (step.step === "browser") {
    await openMsgfWorkspaceIdeSetupBrowser();
    void vscode.window.showInformationMessage(
      "After sign-in: copy the settings JSON → run MSGF: Apply workspace settings from clipboard."
    );
  } else if (step.step === "apply") {
    await applyWorkspaceSettingsFromClipboard();
  } else {
    await runTestConnection(context);
  }
}

export function registerIdeSetupCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.testConnection", () => {
      void runTestConnection(context);
    }),
    vscode.commands.registerCommand("msgf.applyWorkspaceSettings", () => {
      void applyWorkspaceSettingsFromClipboard();
    }),
    vscode.commands.registerCommand("msgf.runSetupWizard", () => {
      void runSetupWizard(context);
    }),
    vscode.commands.registerCommand("msgf.copyIdeTokenSetup", () => {
      void openMsgfWorkspaceIdeSetupBrowser();
    })
  );
}
