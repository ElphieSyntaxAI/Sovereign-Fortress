import * as vscode from "vscode";

import { PILLAR_POLL_INTERVAL_MS } from "./constants";
import {
  fetchPillarHealthReport,
  formatPillarList,
  stoplightFromReport,
} from "./pillarStoplightPoller";

const INITIAL_TEXT = "$(sync~spin) MSGF: Initializing...";

/**
 * Six-pillar MSGF stoplight indicator (polls Cloud Run health every 30s).
 */
export class StoplightStatusBar {
  readonly item: vscode.StatusBarItem;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "msgf.openDashboard";
    this.item.text = INITIAL_TEXT;
    this.item.tooltip = "MSGF 6-Pillar governance stoplight — loading…";
    this.item.backgroundColor = undefined;
    this.item.show();
  }

  start(): void {
    void this.refresh();
    this.pollTimer = setInterval(() => {
      void this.refresh();
    }, PILLAR_POLL_INTERVAL_MS);
  }

  /** Immediate poll (e.g. after settings change). */
  refresh(): Promise<void> {
    return this.poll();
  }

  dispose(): void {
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.item.dispose();
  }

  private async poll(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;

    try {
      const result = await fetchPillarHealthReport();
      if (!result.ok) {
        this.applyError(result.error);
        return;
      }

      const { tone, degraded, violations } = stoplightFromReport(result.report);

      if (tone === "red") {
        this.item.text = "$(error) MSGF: Red";
        this.item.tooltip =
          violations.length > 0
            ? `Halt / failure — violations:\n${formatPillarList(violations)}`
            : "Halt / failure on one or more governance pillars.";
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        return;
      }

      if (tone === "yellow") {
        this.item.text = "$(warning) MSGF: Yellow";
        this.item.tooltip =
          degraded.length > 0
            ? `Degraded pillars:\n${formatPillarList(degraded)}`
            : "One or more governance pillars require attention.";
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        return;
      }

      this.item.text = "$(check) MSGF: Green";
      this.item.tooltip = "All 6 Governance Pillars Healthy";
      this.item.backgroundColor = undefined;
    } finally {
      this.inFlight = false;
    }
  }

  private applyError(message: string): void {
    this.item.text = "$(warning) MSGF: Yellow";
    this.item.tooltip = `Pillar health unavailable: ${message}`;
    this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  }
}
