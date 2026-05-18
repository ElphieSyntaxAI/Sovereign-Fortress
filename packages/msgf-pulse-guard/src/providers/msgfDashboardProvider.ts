import * as vscode from "vscode";

import { readMsgfSettings, resolveTenantId } from "../config";
import { fetchPillarHealthReport } from "../pillarStoplightPoller";
import type { PillarHealthReport } from "../pillarHealthTypes";
import type { WrongLogicViolation } from "../pulseViolationAudit";
import { runShadowPolicyScan } from "../shadowScan";
import {
  buildDashboardWebviewHtml,
  type DashboardHealthView,
} from "./dashboardWebviewHtml";

const SHADOW_SCAN_PROGRESS_TITLE = "Executing Live MSGF Shadow Policy Scan...";

/**
 * Activity-bar sidebar operational dashboard (health + shadow scan).
 */
export class MSGFDashboardProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "msgf.dashboard";

  private view: vscode.WebviewView | undefined;
  private healthReport: PillarHealthReport | null = null;
  private healthError: string | null = null;
  private scanMessage: string | null = null;
  private scanOk: boolean | null = null;
  private violationSummary: string | null = null;
  private violationDiagnostics: WrongLogicViolation["diagnostics"] | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    void this.refreshHealth().then(() => this.render());

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.refreshHealth().then(() => this.render());
      }
    });
  }

  /** External refresh hook (e.g. after config change). */
  async refresh(): Promise<void> {
    await this.refreshHealth();
    this.render();
  }

  /** Reveal P6 / 1.1.1 genealogical diagnostics (from pulse Wrong Logic toast). */
  showViolationDiagnostics(violation: WrongLogicViolation | null): void {
    if (!violation) return;
    this.violationSummary = violation.errorMessage;
    this.violationDiagnostics = violation.diagnostics;
    this.render();
    void vscode.commands.executeCommand("msgf.dashboard.focus");
  }

  private async refreshHealth(): Promise<void> {
    const result = await fetchPillarHealthReport();
    if (result.ok) {
      this.healthReport = result.report;
      this.healthError = null;
    } else {
      this.healthError = result.error;
    }
  }

  private render(): void {
    if (!this.view) return;

    const settings = readMsgfSettings();
    const viewModel: DashboardHealthView = {
      apiUrl: settings.apiUrl,
      tenantId: resolveTenantId(settings),
      report: this.healthReport,
      healthError: this.healthError,
      scanMessage: this.scanMessage,
      scanOk: this.scanOk,
      violationSummary: this.violationSummary,
      violationDiagnostics: this.violationDiagnostics,
    };

    this.view.webview.html = buildDashboardWebviewHtml(viewModel);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (
      !message ||
      typeof message !== "object" ||
      (message as { type?: string }).type !== "triggerShadowScan"
    ) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: SHADOW_SCAN_PROGRESS_TITLE,
        cancellable: false,
      },
      async () => {
        const result = await runShadowPolicyScan();

        if (result.ok) {
          this.scanOk = true;
          this.scanMessage = result.message;
        } else {
          this.scanOk = false;
          const detail =
            result.ruleErrors.length > 0
              ? result.ruleErrors.join(" · ")
              : result.message;
          this.scanMessage = detail;
        }

        this.view?.webview.postMessage({
          type: "shadowScanResult",
          ok: result.ok,
          message: this.scanMessage,
          ruleErrors: result.ok ? [] : result.ruleErrors,
        });

        await this.refreshHealth();
        this.render();
      }
    );
  }
}

export function registerMsgfDashboardProvider(
  context: vscode.ExtensionContext
): MSGFDashboardProvider {
  const provider = new MSGFDashboardProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MSGFDashboardProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  return provider;
}
