import * as vscode from "vscode";

import { PILLAR_POLL_INTERVAL_MS } from "./constants";
import {
  fetchPillarHealthReport,
  formatPillarList,
  stoplightFromReport,
} from "./pillarStoplightPoller";

const INITIAL_TEXT = "$(sync~spin) MSGF: Initializing...";

/** Jewel Tone stoplight — theme colors registered in package.json */
const THEME = {
  greenFg: "msgf.jewel.stoplight.green",
  amberFg: "msgf.jewel.stoplight.amber",
  rubyFg: "msgf.jewel.stoplight.ruby",
  midnightBg: "msgf.jewel.midnight",
  greenBg: "msgf.jewel.stoplight.greenBg",
  amberBg: "msgf.jewel.stoplight.amberBg",
  rubyBg: "msgf.jewel.stoplight.rubyBg",
} as const;

export type StoplightAnomalyHandler = (tone: "yellow" | "red") => void;
export type StoplightPollCompleteHandler = () => void;
export type MsgfShadowTone = "pending" | "green" | "red";

/**
 * Six-pillar MSGF stoplight indicator (polls Cloud Run health every 30s).
 * A5: optional shadow overlay for async Safe Build verify-result.
 */
export class StoplightStatusBar {
  readonly item: vscode.StatusBarItem;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private lastTone: "green" | "yellow" | "red" | "init" = "init";
  private shadow: MsgfShadowTone | null = null;
  private shadowDetail: string | undefined;

  constructor(
    private readonly onAnomaly?: StoplightAnomalyHandler,
    private readonly onPollComplete?: StoplightPollCompleteHandler,
    private readonly resolveEntityId?: () => Promise<string>
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "msgf.openDashboard";
    this.item.text = INITIAL_TEXT;
    this.item.tooltip = "MSGF 6-Pillar governance stoplight — loading…";
    this.applyJewelState("init");
    this.item.show();
  }

  /** A5 async preflight: pending | green | red overlay (null clears). */
  setShadowState(state: MsgfShadowTone | null, detail?: string): void {
    this.shadow = state;
    this.shadowDetail = detail;
    this.applyShadowDisplay();
  }

  start(): void {
    void this.refresh();
    this.pollTimer = setInterval(() => {
      void this.refresh();
    }, PILLAR_POLL_INTERVAL_MS);
  }

  refresh(): Promise<void> {
    return this.poll();
  }

  dispose(): void {
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.shadow = null;
    this.item.dispose();
  }

  private applyShadowDisplay(): void {
    if (!this.shadow) return;
    const detail = this.shadowDetail ? `\n${this.shadowDetail}` : "";
    switch (this.shadow) {
      case "pending":
        this.item.text = "$(sync~spin) MSGF shadow: pending";
        this.item.tooltip = `Async verify-result in flight.${detail}`;
        this.applyJewelState("yellow");
        break;
      case "green":
        this.item.text = "$(check) MSGF shadow: green";
        this.item.tooltip = `Async verify-result synced (pass).${detail}`;
        this.applyJewelState("green");
        break;
      case "red":
        this.item.text = "$(error) MSGF shadow: red";
        this.item.tooltip = `Async verify-result / sync failed or build failed.${detail}`;
        this.applyJewelState("red");
        break;
    }
  }

  private applyJewelState(
    state: "init" | "green" | "yellow" | "red"
  ): void {
    switch (state) {
      case "green":
        this.item.color = new vscode.ThemeColor(THEME.greenFg);
        this.item.backgroundColor = new vscode.ThemeColor(THEME.greenBg);
        break;
      case "yellow":
        this.item.color = new vscode.ThemeColor(THEME.amberFg);
        this.item.backgroundColor = new vscode.ThemeColor(THEME.amberBg);
        break;
      case "red":
        this.item.color = new vscode.ThemeColor(THEME.rubyFg);
        this.item.backgroundColor = new vscode.ThemeColor(THEME.rubyBg);
        break;
      default:
        this.item.color = new vscode.ThemeColor(THEME.amberFg);
        this.item.backgroundColor = new vscode.ThemeColor(THEME.midnightBg);
        break;
    }
  }

  private async poll(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;

    try {
      const entityId = this.resolveEntityId ? await this.resolveEntityId() : undefined;
      const result = await fetchPillarHealthReport({ entityId });
      if (!result.ok) {
        this.applyError(result.error, result.errorDetail);
        return;
      }

      const { tone, degraded, violations } = stoplightFromReport(result.report);

      if (tone === "red") {
        this.item.text = "$(error) MSGF: Red";
        this.item.tooltip =
          violations.length > 0
            ? `Halt / failure — violations:\n${formatPillarList(violations)}`
            : "Halt / failure on one or more governance pillars.";
        this.applyJewelState("red");
        this.notifyAnomalyIfNeeded("red");
        this.applyShadowDisplay();
        return;
      }

      if (tone === "yellow") {
        this.item.text = "$(warning) MSGF: Yellow";
        this.item.tooltip =
          degraded.length > 0
            ? `Degraded pillars:\n${formatPillarList(degraded)}`
            : "One or more governance pillars require attention.";
        this.applyJewelState("yellow");
        this.notifyAnomalyIfNeeded("yellow");
        this.applyShadowDisplay();
        return;
      }

      this.item.text = "$(check) MSGF: Green";
      this.item.tooltip = "All 6 Governance Pillars Healthy";
      this.applyJewelState("green");
      this.lastTone = "green";
      this.applyShadowDisplay();
    } finally {
      this.inFlight = false;
      this.onPollComplete?.();
    }
  }

  private applyError(message: string, detail?: string): void {
    this.item.text = "$(cloud-off) MSGF: Offline";
    this.item.tooltip =
      detail ??
      `Cannot reach MSGF API — Pulse and pillar health are not updating.\n${message}\n\nRun MSGF: Test connection or MSGF: Open IDE token setup (browser).`;
    this.applyJewelState("init");
    this.lastTone = "init";
    this.applyShadowDisplay();
  }

  private notifyAnomalyIfNeeded(tone: "yellow" | "red"): void {
    if (this.lastTone === tone) return;
    this.lastTone = tone;
    this.onAnomaly?.(tone);
  }
}
