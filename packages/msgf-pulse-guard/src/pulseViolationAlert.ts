import * as vscode from "vscode";

import type { MSGFDashboardProvider } from "./providers/msgfDashboardProvider";
import {
  auditPulseResponseForWrongLogic,
  type WrongLogicViolation,
} from "./pulseViolationAudit";

export const MSGF_REVIEW_DETAILS_ACTION = "Review Details";

let lastViolation: WrongLogicViolation | null = null;
let dashboardProvider: MSGFDashboardProvider | null = null;

export function bindViolationDashboardProvider(provider: MSGFDashboardProvider): void {
  dashboardProvider = provider;
}

export function getLastWrongLogicViolation(): WrongLogicViolation | null {
  return lastViolation;
}

export function registerViolationCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("msgf.openDiagnostics", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.msgf-ops");
      await vscode.commands.executeCommand("msgf.dashboard.focus");
      dashboardProvider?.showViolationDiagnostics(lastViolation);
    })
  );
}

/**
 * Audit pulse JSON and surface native alert when Wrong Logic / Hall state is detected.
 */
export function handlePulseResponseViolations(raw: Record<string, unknown>): boolean {
  const violation = auditPulseResponseForWrongLogic(raw);
  if (!violation) return false;

  lastViolation = violation;
  const toast = `[MSGF Violation] Wrong Logic Detected in active workspace! Delta dropped to Hall ledger: ${violation.errorMessage}`;

  void vscode.window
    .showErrorMessage(toast, MSGF_REVIEW_DETAILS_ACTION)
    .then((choice) => {
      if (choice === MSGF_REVIEW_DETAILS_ACTION) {
        void vscode.commands.executeCommand("msgf.openDiagnostics");
      }
    });

  return true;
}
