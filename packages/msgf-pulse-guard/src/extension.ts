/**
 * MSGF Pulse Guard — VS Code / Cursor extension (V3.2-ULTRA IDE Pulse path).
 */
import * as vscode from "vscode";

import { readMsgfSettings, resolveEntityId, settingsReady } from "./config";
import { registerOpenDashboardCommand } from "./dashboardPanel";
import { registerOptimizerCommands } from "./commands/optimizer";
import { registerGenerateContextPackCommand } from "./generateContextPack";
import { registerDevKitCommands } from "./devKitCommands";
import { registerIdeSetupCommands } from "./ideSetupCommands";
import { registerSubmitVerifyResultCommand } from "./submitVerifyResultCommand";
import { registerMsgfUriHandler, registerWorkspaceWithMsgf } from "./uriHandler";
import { registerMsgfExternalAuthCommands } from "./openMsgfExternal";
import { GuardSession } from "./guardSession";
import {
  bindViolationDashboardProvider,
  registerViolationCommands,
} from "./pulseViolationAlert";
import { registerMsgfDashboardProvider } from "./providers/msgfDashboardProvider";
import { StoplightStatusBar } from "./stoplightStatusBar";
import { initializeMsgfWorkspace } from "./workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

let session: GuardSession | null = null;
let stoplightBar: StoplightStatusBar | null = null;
let sidebarDashboard: ReturnType<typeof registerMsgfDashboardProvider> | null = null;

export function activate(context: vscode.ExtensionContext): void {
  console.log(`${LOG_PREFIX} Extension successfully initialized.`);

  void initializeMsgfWorkspace(context.extensionPath).then((root) => {
    if (root) {
      console.info(`${LOG_PREFIX} Workspace .msgf/ scaffold ready at ${root}`);
    }
  });

  registerOpenDashboardCommand(context);
  registerMsgfExternalAuthCommands(context);
  registerIdeSetupCommands(context);
  registerDevKitCommands(context);
  registerGenerateContextPackCommand(context);
  registerOptimizerCommands(context);
  registerSubmitVerifyResultCommand(context);
  registerMsgfUriHandler(context);
  registerViolationCommands(context);
  sidebarDashboard = registerMsgfDashboardProvider(context);
  bindViolationDashboardProvider(sidebarDashboard);

  stoplightBar = new StoplightStatusBar(
    (tone) => {
      sidebarDashboard?.onHealthAnomaly(tone);
    },
    () => {
      void sidebarDashboard?.refresh();
    },
    async () => resolveEntityId(context, readMsgfSettings())
  );
  stoplightBar.start();
  context.subscriptions.push({ dispose: () => stoplightBar?.dispose() });

  session = new GuardSession(context, {
    onSnapshot: (snapshot) => {
      if (snapshot.routing === "error" && snapshot.error) {
        sidebarDashboard?.reportPulseError(snapshot.error);
      } else {
        sidebarDashboard?.clearPulseError();
      }
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
    vscode.commands.registerCommand("msgf.copyHealPrompt", () => {
      void sidebarDashboard?.copyHealPrompt();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration("msgf")) return;
      await session?.reloadFromSettings();
      void stoplightBar?.refresh();
      void sidebarDashboard?.refresh();
      const settings = readMsgfSettings();
      const ready = settingsReady(settings);
      if (!ready.ok) {
        void vscode.window.showWarningMessage(
          `${LOG_PREFIX} Update settings: ${ready.missing.join(", ")}`
        );
      }
    })
  );

  void session.start().then(async () => {
    void registerWorkspaceWithMsgf();
    const settings = readMsgfSettings();
    const ready = settingsReady(settings);
    if (!ready.ok) {
      const pick = await vscode.window.showWarningMessage(
        `${LOG_PREFIX} Set ${ready.missing.join(" and ")} to enable Pulse buffering.`,
        "Setup wizard"
      );
      if (pick === "Setup wizard") {
        void vscode.commands.executeCommand("msgf.runSetupWizard");
      }
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
