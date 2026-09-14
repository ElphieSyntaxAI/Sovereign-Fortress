import * as vscode from "vscode";

/** Verbatim from docs/msgf/build-plans/MSGF_DX_ELEVATION_PLAN.md */
export const HAL_FRICTION_NOTICE_TEXT = `[MSGF P4 Telemetry Notice]: High keystroke friction detected over the last 15 minutes.
Your local logic drift slope is fluctuating.
Action Recommended: Click 'Generate 0-Token Context Pack' to unblock this function without cloud token drain.`;

const WINDOW_MS = 15 * 60 * 1000;
/** Keystroke-equivalent change events in 15m before notice. */
const FRICTION_EVENT_THRESHOLD = 180;
const COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Rolling 15m heuristic on edit events — non-blocking HAL friction notice (P3).
 */
export class HalFrictionTracker {
  private timestamps: number[] = [];
  private lastNoticeAt = 0;

  recordEditEvents(count: number): void {
    if (count <= 0) return;
    const now = Date.now();
    this.timestamps.push(...Array(count).fill(now));
    this.prune(now);
    this.maybeNotify(now);
  }

  private prune(now: number): void {
    const cutoff = now - WINDOW_MS;
    while (this.timestamps.length && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }

  private maybeNotify(now: number): void {
    if (this.timestamps.length < FRICTION_EVENT_THRESHOLD) return;
    if (now - this.lastNoticeAt < COOLDOWN_MS) return;
    this.lastNoticeAt = now;

    void vscode.window
      .showInformationMessage(HAL_FRICTION_NOTICE_TEXT, "Generate 0-Token Context Pack")
      .then((pick) => {
        if (pick === "Generate 0-Token Context Pack") {
          void vscode.commands.executeCommand("msgf.generateContextPack");
        }
      });
  }
}
