import * as vscode from "vscode";

import { readMsgfSettings, resolveTenantId } from "./config";
import { getLastDevHealChoiceForVerify } from "./lastDevHealChoice";
import { postVerifyResult } from "./verifyResultClient";

const LOG_PREFIX = "[MSGF Guard]";

export function registerSubmitVerifyResultCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.submitVerifyResult", async () => {
      const settings = readMsgfSettings();
      const tenantKey = resolveTenantId(settings);

      const passedPick = await vscode.window.showQuickPick(
        [
          { label: "Passed", passed: true },
          { label: "Failed", passed: false },
        ],
        { title: "MSGF verify result", placeHolder: "Did your verify command pass?" }
      );
      if (!passedPick) return;

      const command = await vscode.window.showInputBox({
        title: "Verify command (optional)",
        placeHolder: "npm test",
      });

      const result = await postVerifyResult({
        settings,
        tenantKey,
        body: {
          passed: passedPick.passed,
          command: command?.trim() || undefined,
          dev_heal_choice: getLastDevHealChoiceForVerify(),
        },
      });

      if (!result.ok) {
        void vscode.window.showErrorMessage(
          result.error ?? `${LOG_PREFIX} Could not submit verify result.`
        );
        return;
      }

      void vscode.window.showInformationMessage(
        `MSGF verify result logged${result.narrative_log_id ? ` (${result.narrative_log_id.slice(0, 8)}…)` : ""}.`
      );
    })
  );
}
