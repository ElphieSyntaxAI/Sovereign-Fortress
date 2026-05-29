import * as vscode from "vscode";

import {
  executeRunScriptCommand,
  showRunScriptResult,
} from "../utils/run-script-executor";
import { loadRunScripts, type RunScriptEntry } from "../utils/run-scripts-store";
import { getWorkspaceRoot } from "../workspace/msgfWorkspace";

const LOG_PREFIX = "[MSGF Guard]";

function resolveScript(scriptId?: string): RunScriptEntry | null {
  const scripts = loadRunScripts();
  if (!scripts.length) return null;
  if (!scriptId?.trim()) return scripts[0] ?? null;
  return scripts.find((s) => s.id === scriptId) ?? scripts[0] ?? null;
}

export async function runVerifyScript(scriptId?: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage(
      `${LOG_PREFIX} Open a workspace folder before running verify scripts.`
    );
    return;
  }

  const script = resolveScript(scriptId);
  if (!script) {
    void vscode.window.showWarningMessage(
      `${LOG_PREFIX} No verify scripts yet — generate a 0-token prompt first.`
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `MSGF verify: ${script.label}`,
      cancellable: false,
    },
    async () => {
      const result = await executeRunScriptCommand(root, script.command);
      await showRunScriptResult(result);
    }
  );
}

export function registerRunScriptsCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.runVerifyScripts", (scriptId?: string) => {
      void runVerifyScript(typeof scriptId === "string" ? scriptId : undefined);
    })
  );
}
