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
import { registerMonorepoSetupCommands } from "./monorepoSetupCommands";
import { registerRunScriptsCommands } from "./commands/runScripts";
import { registerTerminalDiagnosticCommand } from "./commands/terminalDiagnostic";
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
import { MsgfOptInStatusBar } from "./msgfOptInStatusBar";
import { registerMsgfShadowApplier } from "./shadowStatusBridge";
import { initializeMsgfWorkspace } from "./workspace/msgfWorkspace";
import {
  msgfDisabledHint,
  promptWorkspaceOptIn,
  registerWorkspaceOptInCommands,
  shouldArmGuard,
  warnIfMsgfSecretsAreGlobalOnly,
} from "./workspaceOptIn";

const LOG_PREFIX = "[MSGF Guard]";

let session: GuardSession | null = null;
let stoplightBar: StoplightStatusBar | null = null;
let optInStatusBar: MsgfOptInStatusBar | null = null;
let sidebarDashboard: ReturnType<typeof registerMsgfDashboardProvider> | null = null;
let guardArmed = false;

async function disarmGuard(): Promise<void> {
  guardArmed = false;
  session?.dispose();
  session = null;
  registerMsgfShadowApplier(null);
  stoplightBar?.dispose();
  stoplightBar = null;
  if (!optInStatusBar) {
    optInStatusBar = new MsgfOptInStatusBar();
  }
  void sidebarDashboard?.refresh();
}

async function armGuard(context: vscode.ExtensionContext): Promise<void> {
  if (guardArmed) {
    await session?.reloadFromSettings();
    void stoplightBar?.refresh();
    void sidebarDashboard?.refresh();
    return;
  }

  guardArmed = true;
  optInStatusBar?.dispose();
  optInStatusBar = null;

  const root = await initializeMsgfWorkspace(context.extensionPath);
  if (root) {
    console.info(`${LOG_PREFIX} Workspace .msgf/ scaffold ready at ${root}`);
  }

  if (!stoplightBar) {
    stoplightBar = new StoplightStatusBar(
      (tone) => {
        sidebarDashboard?.onHealthAnomaly(tone);
      },
      () => {
        void sidebarDashboard?.refresh();
      },
      async () => resolveEntityId(context, readMsgfSettings())
    );
    context.subscriptions.push({ dispose: () => stoplightBar?.dispose() });
  }
  stoplightBar.start();
  registerMsgfShadowApplier((state, detail) => {
    stoplightBar?.setShadowState(state, detail);
  });

  if (!session) {
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
  }

  await session.start();
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
}

async function syncGuardArmState(context: vscode.ExtensionContext): Promise<void> {
  if (shouldArmGuard()) {
    await armGuard(context);
  } else {
    await disarmGuard();
    console.info(`${LOG_PREFIX} ${msgfDisabledHint()}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  console.log(`${LOG_PREFIX} Extension loaded (per-workspace opt-in via msgf.enabled).`);

  registerOpenDashboardCommand(context);
  registerMsgfExternalAuthCommands(context);
  registerIdeSetupCommands(context);
  registerMonorepoSetupCommands(context);
  registerDevKitCommands(context);
  registerGenerateContextPackCommand(context);
  registerOptimizerCommands(context);
  registerTerminalDiagnosticCommand(context);
  registerRunScriptsCommands(context);
  registerSubmitVerifyResultCommand(context);
  registerMsgfUriHandler(context);
  registerViolationCommands(context);
  registerWorkspaceOptInCommands(context);
  sidebarDashboard = registerMsgfDashboardProvider(context);
  bindViolationDashboardProvider(sidebarDashboard);

  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.flushPulse", () => {
      if (!shouldArmGuard()) {
        void vscode.window.showInformationMessage(msgfDisabledHint());
        return;
      }
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
      await syncGuardArmState(context);
      if (!shouldArmGuard()) return;
      const settings = readMsgfSettings();
      const ready = settingsReady(settings);
      if (!ready.ok) {
        void vscode.window.showWarningMessage(
          `${LOG_PREFIX} Update settings: ${ready.missing.join(", ")}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void (async () => {
        await syncGuardArmState(context);
        if (!shouldArmGuard()) {
          await promptWorkspaceOptIn(context);
        }
      })();
    })
  );

  void (async () => {
    await syncGuardArmState(context);
    if (!shouldArmGuard()) {
      await promptWorkspaceOptIn(context);
    }
    await warnIfMsgfSecretsAreGlobalOnly(context);
  })();
}

export function deactivate(): void {
  void disarmGuard();
  optInStatusBar?.dispose();
  optInStatusBar = null;
  console.log(`${LOG_PREFIX} Extension deactivated.`);
}
