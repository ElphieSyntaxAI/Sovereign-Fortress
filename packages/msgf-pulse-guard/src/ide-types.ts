/** P1 rhythm-layer keystroke (aligned with MSGF `UniversalP1KeystrokeEvent`). */
export type PulseKeystrokeEvent = {
  ts: number;
  key: string;
  type?: "keydown" | "keyup" | "input";
  target?: string;
};

/** Local mirrors of IdeConnector status types. */

export type IdeStatusRouting =
  | "idle"
  | "buffering"
  | "pending"
  | "local_gateway"
  | "global"
  | "baseline_required"
  | "error";

export type IdeStatusBarSnapshot = {
  logicDriftScore: number | null;
  logicDriftLabel: string;
  escalationThreshold: number | null;
  routing: IdeStatusRouting;
  defendTier: "GREEN" | "YELLOW" | "RED" | null;
  baselineRequired: boolean;
  humanTiebreakerRequired: boolean;
  bufferedEventCount: number;
  updatedAt: number | null;
  error?: string;
};
