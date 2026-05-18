/**
 * MSGF Pulse Guard — VS Code / Cursor extension (V3.2-ULTRA IDE Pulse path).
 */
import * as vscode from "vscode";

import { readMsgfSettings, settingsReady } from "./config";
import { registerOpenDashboardCommand } from "./dashboardPanel";
import { GuardSession } from "./guardSession";
import { StoplightStatusBar } from "./stoplightStatusBar";

const LOG_PREFIX = "[MSGF Guard]";

let session: GuardSession | null = null;
let stoplightBar: StoplightStatusBar | null = null;

export function activate(context: vscode.ExtensionContext): void {
  console.log(`${LOG_PREFIX} Extension successfully initialized.`);

  stoplightBar = new StoplightStatusBar();
  stoplightBar.start();
  context.subscriptions.push({ dispose: () => stoplightBar?.dispose() });

  registerOpenDashboardCommand(context);

  session = new GuardSession(context, {
    onSnapshot: () => {
      /* Pulse telemetry runs in background; stoplight bar owns status UI. */
    },
  });

  context.subscriptions.push({
    dispose: () => {
      session?.dispose();
      session = null;
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.flushPulse", () => {
      void session?.flushNow();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration("msgf")) return;
      await session?.reloadFromSettings();
      void stoplightBar?.refresh();
      const settings = readMsgfSettings();
      const ready = settingsReady(settings);
      if (!ready.ok) {
        void vscode.window.showWarningMessage(
          `${LOG_PREFIX} Update settings: ${ready.missing.join(", ")}`
        );
      }
    })
  );

  void session.start().then(() => {
    const settings = readMsgfSettings();
    const ready = settingsReady(settings);
    if (!ready.ok) {
      void vscode.window.showWarningMessage(
        `${LOG_PREFIX} Set ${ready.missing.join(" and ")} to enable Pulse buffering.`
      );
    }
  });
}

export function deactivate(): void {
  session?.dispose();
  session = null;
  stoplightBar?.dispose();
  stoplightBar = null;
  console.log(`${LOG_PREFIX} Extension deactivated.`);
}
