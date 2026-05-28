import * as vscode from "vscode";

import { readMsgfSettings, resolveTenantId } from "../config";
import { isSavePrimaryPulseMode } from "../devSessionPulse";
import { promptDevHealCycleChoice } from "../devHealCycle";
import { setLastDevHealChoice } from "../lastDevHealChoice";
import {
  fetchAgentContextPack,
  fetchHealQueueTasks,
  postDevCycleStart,
  postHealQueueAction,
  resolveHealQueueTenantUuid,
  tasksFromScanRuleErrors,
  toHealConsoleTasks,
} from "../healQueueClient";
import type { DevHandoffInfo, HealConsoleTask, HealQueuePresetInterval } from "../healQueueTypes";
import { fetchPillarHealthReport } from "../pillarStoplightPoller";
import type { PillarHealthReport } from "../pillarHealthTypes";
import { buildHealAgentPrompt } from "../healPromptBuilder";
import type { WrongLogicViolation } from "../pulseViolationAudit";
import { runShadowPolicyScan } from "../shadowScan";
import {
  buildDashboardWebviewHtml,
  type DashboardHealthView,
} from "./dashboardWebviewHtml";
import type { HealingConsoleView } from "./healingConsoleHtml";

const SHADOW_SCAN_PROGRESS_TITLE = "Executing Live MSGF Shadow Policy Scan...";

type WebviewMessage = {
  type?: string;
  action_type?: "BULK" | "INDIVIDUAL" | "SCHEDULED";
  file_paths?: string[];
  preset_interval?: HealQueuePresetInterval;
};

/**
 * Activity-bar sidebar operational dashboard (health + shadow scan + healing console).
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

  private healConsoleVisible = false;
  private healTriggerLabel = "Awaiting ingest or stoplight signal";
  private healTasks: HealConsoleTask[] = [];
  private healBrainSummary: string | null = null;
  private healQueueError: string | null = null;
  private healTenantUuid: string | null = null;
  private healDevHandoff: DevHandoffInfo | null = null;
  private lastScanRuleErrors: string[] = [];
  private pulseError: string | null = null;
  private lastPulseErrorToastAt = 0;

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

  /** Pulse flush failed — surface in sidebar (not only Output console). */
  clearPulseError(): void {
    if (!this.pulseError) return;
    this.pulseError = null;
    this.render();
  }

  reportPulseError(message: string): void {
    const trimmed = message.trim();
    if (!trimmed) return;
    this.pulseError = trimmed;
    this.render();
    const now = Date.now();
    if (now - this.lastPulseErrorToastAt > 60_000) {
      this.lastPulseErrorToastAt = now;
      void vscode.window.showWarningMessage(`[MSGF Guard] Pulse: ${trimmed}`);
    }
  }

  /** External refresh hook (e.g. after config change). */
  async refresh(): Promise<void> {
    await this.refreshHealth();
    if (this.healConsoleVisible) {
      await this.refreshHealQueue(this.lastScanRuleErrors);
    }
    this.render();
  }

  /** 30s stoplight poll detected yellow/red — surface healing console. */
  onHealthAnomaly(tone: "yellow" | "red"): void {
    this.healConsoleVisible = true;
    this.healTriggerLabel =
      tone === "red"
        ? "Stoplight halt — genealogical or pillar violations detected"
        : "Stoplight degraded — missing pillars or broken roots suspected";
    void this.openHealingConsole();
  }

  /** Reveal P6 / 1.1.1 genealogical diagnostics (from pulse Wrong Logic toast). */
  showViolationDiagnostics(violation: WrongLogicViolation | null): void {
    if (!violation) return;
    this.violationSummary = violation.errorMessage;
    this.violationDiagnostics = violation.diagnostics;
    this.healConsoleVisible = true;
    this.healTriggerLabel = "Wrong-logic violation — review and approve remediation";
    this.render();
    void this.openHealingConsole();
    void vscode.commands.executeCommand("msgf.dashboard.focus");
  }

  private async openHealingConsole(): Promise<void> {
    await this.refreshHealQueue(this.lastScanRuleErrors);
    this.render();
    void vscode.commands.executeCommand("msgf.dashboard.focus");
  }

  private async refreshHealQueue(fallbackRuleErrors: string[] = []): Promise<void> {
    const settings = readMsgfSettings();
    const tenantKey = resolveTenantId(settings);
    this.healTenantUuid = resolveHealQueueTenantUuid(tenantKey);

    const result = await fetchHealQueueTasks({ settings, tenantKey });

    if (result.ok && result.tasks.length > 0) {
      this.healTasks = result.tasks;
      this.healBrainSummary = result.brainSummary;
      this.healDevHandoff = result.devHandoff;
      this.healQueueError = null;
      this.healConsoleVisible = true;
      return;
    }

    const fallback = toHealConsoleTasks(tasksFromScanRuleErrors(fallbackRuleErrors));
    if (fallback.length > 0) {
      this.healTasks = fallback;
      this.healBrainSummary = result.brainSummary;
      this.healQueueError = result.error ?? null;
      this.healConsoleVisible = true;
      return;
    }

    if (result.ok) {
      this.healTasks = [];
      this.healBrainSummary = result.brainSummary;
      this.healDevHandoff = result.devHandoff;
      this.healQueueError = null;
      if (!fallbackRuleErrors.length) {
        this.healConsoleVisible = false;
      }
      return;
    }

    this.healTasks = fallback;
    this.healBrainSummary = null;
    this.healQueueError = result.error ?? "Heal queue unavailable.";
    if (fallback.length > 0 || this.healConsoleVisible) {
      this.healConsoleVisible = true;
    }
  }

  private async refreshHealth(): Promise<void> {
    const result = await fetchPillarHealthReport();
    if (result.ok) {
      this.healthReport = result.report;
      this.healthError = null;
    } else {
      this.healthReport = null;
      this.healthError = result.error;
    }
  }

  private healingConsoleView(): HealingConsoleView {
    return {
      visible: this.healConsoleVisible,
      triggerLabel: this.healTriggerLabel,
      brainSummary: this.healBrainSummary,
      tasks: this.healTasks,
      healQueueError: this.healQueueError,
    };
  }

  private render(): void {
    if (!this.view) return;

    const settings = readMsgfSettings();
    const viewModel: DashboardHealthView = {
      apiUrl: settings.apiUrl,
      tenantId: resolveTenantId(settings),
      pulseModeHint: isSavePrimaryPulseMode(settings)
        ? "Dev session: keystrokes buffer locally; Pulse POSTs on file save (x-msgf-flush-reason: save)."
        : "Live mode: keystroke batches POST to /api/msgf/pulse every few seconds when armed.",
      report: this.healthReport,
      healthError: this.healthError,
      pulseError: this.pulseError,
      scanMessage: this.scanMessage,
      scanOk: this.scanOk,
      violationSummary: this.violationSummary,
      violationDiagnostics: this.violationDiagnostics,
      healingConsole: this.healingConsoleView(),
    };

    this.view.webview.html = buildDashboardWebviewHtml(viewModel);
  }

  async copyHealPrompt(selectedPaths?: string[]): Promise<void> {
    const settings = readMsgfSettings();
    const folder = vscode.workspace.workspaceFolders?.[0]?.name;
    const prompt = buildHealAgentPrompt({
      tenantKey: resolveTenantId(settings),
      apiUrl: settings.apiUrl,
      triggerLabel: this.healTriggerLabel,
      brainSummary: this.healBrainSummary,
      scanRuleErrors: this.lastScanRuleErrors,
      pulseError: this.pulseError,
      healthError: this.healthError,
      violationSummary: this.violationSummary,
      tasks: this.healTasks,
      selectedPaths,
      workspaceFolderName: folder,
    });

    await vscode.env.clipboard.writeText(prompt);
    void vscode.window.showInformationMessage(
      "MSGF heal prompt copied — paste into Cursor or Claude chat to fix files locally."
    );
  }

  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as WebviewMessage;
    if (!msg?.type) return;

    if (msg.type === "copyHealPrompt") {
      const paths = Array.isArray(msg.file_paths)
        ? msg.file_paths.filter((p): p is string => typeof p === "string")
        : undefined;
      await this.copyHealPrompt(paths);
      return;
    }

    if (msg.type === "refreshHealConsole") {
      await this.refreshHealQueue(this.lastScanRuleErrors);
      this.render();
      return;
    }

    if (msg.type === "devHealCycle") {
      const paths = Array.isArray(msg.file_paths)
        ? msg.file_paths.filter((p): p is string => typeof p === "string")
        : undefined;
      await this.runDevHealCycle(paths);
      return;
    }

    if (msg.type === "healQueueAction") {
      await this.handleHealQueueAction(msg);
      return;
    }

    if (msg.type !== "triggerShadowScan") return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: SHADOW_SCAN_PROGRESS_TITLE,
        cancellable: false,
      },
      async () => {
        const result = await runShadowPolicyScan();
        this.lastScanRuleErrors = result.ok ? [] : result.ruleErrors;

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

        await this.refreshHealQueue(this.lastScanRuleErrors);
        const needsConsole =
          !result.ok || result.ruleErrors.length > 0 || this.healTasks.length > 0;
        if (needsConsole) {
          this.healConsoleVisible = true;
          this.healTriggerLabel = !result.ok || result.ruleErrors.length > 0
            ? "Post-ingest scan — missing pillars or broken genealogical roots"
            : "Shadow scan complete — remediation queue ready";
        }

        this.view?.webview.postMessage({
          type: "shadowScanResult",
          ok: result.ok,
          message: this.scanMessage,
          showHealingConsole: needsConsole || this.healTasks.length > 0,
        });

        await this.refreshHealth();
        this.render();
      }
    );
  }

  private async runDevHealCycle(file_paths?: string[]): Promise<void> {
    const settings = readMsgfSettings();
    const tenantKey = resolveTenantId(settings);
    const tenantUuid = this.healTenantUuid ?? resolveHealQueueTenantUuid(tenantKey);

    const cycle = await postDevCycleStart({ settings, tenantUuid, file_paths });
    if (cycle.dev_handoff) {
      this.healDevHandoff = cycle.dev_handoff;
    }

    const choice = await promptDevHealCycleChoice(this.healDevHandoff ?? cycle.dev_handoff);
    setLastDevHealChoice(choice);
    if (choice === "cancel") {
      this.view?.webview.postMessage({
        type: "healQueueStatus",
        tone: "idle",
        message: "Heal cancelled — pick self-fix or cloud heal when ready.",
        reload: false,
      });
      return;
    }

    if (choice === "self_guided") {
      const markdown =
        cycle.agent_context_markdown ??
        (
          await fetchAgentContextPack({
            settings,
            tenantUuid,
            mode: "guided",
            file_paths,
          })
        ).markdown;

      if (!markdown) {
        this.view?.webview.postMessage({
          type: "healQueueStatus",
          tone: "error",
          message: cycle.error ?? "Could not fetch agent context pack.",
          reload: false,
        });
        return;
      }

      await vscode.env.clipboard.writeText(markdown);
      void vscode.window.showInformationMessage(
        "MSGF 0-token context pack copied — paste into your agent chat."
      );
      this.view?.webview.postMessage({
        type: "healQueueStatus",
        tone: "success",
        message: "Context pack copied — fix files locally, then re-run shadow scan.",
        reload: false,
      });
      return;
    }

    if (choice === "self_local") {
      await this.copyHealPrompt(file_paths);
      this.view?.webview.postMessage({
        type: "healQueueStatus",
        tone: "success",
        message: "Local heal prompt copied.",
        reload: false,
      });
      return;
    }

    await this.handleHealQueueAction({ action_type: "BULK", file_paths });
  }

  private async handleHealQueueAction(msg: WebviewMessage): Promise<void> {
    const settings = readMsgfSettings();
    const tenantKey = resolveTenantId(settings);
    const tenantUuid = this.healTenantUuid ?? resolveHealQueueTenantUuid(tenantKey);

    const action = msg.action_type;
    if (action !== "BULK" && action !== "INDIVIDUAL" && action !== "SCHEDULED") {
      return;
    }

    const result = await postHealQueueAction({
      settings,
      tenantUuid,
      action_type: action,
      file_paths: msg.file_paths,
      preset_interval: msg.preset_interval,
    });

    if (result.ok) {
      const saved = result.token_estimate?.tokens_saved_vs_individual;
      const extra =
        saved != null && saved > 0 ? ` (~${saved} tokens saved vs individual)` : "";
      const resume = result.user_resume_message ? ` ${result.user_resume_message}` : "";
      const label =
        action === "SCHEDULED"
          ? "Scheduled ⏳ — auto-remediation queued"
          : "Processing ⚡ — complete";
      this.view?.webview.postMessage({
        type: "healQueueStatus",
        tone: "success",
        message: `${label}${extra}${resume}`,
        reload: true,
      });
      await this.refreshHealQueue(this.lastScanRuleErrors);
      if (!this.healTasks.length) {
        this.healConsoleVisible = false;
      }
      return;
    }

    this.view?.webview.postMessage({
      type: "healQueueStatus",
      tone: "error",
      message: result.error ?? "Heal queue action failed.",
      reload: false,
    });
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
