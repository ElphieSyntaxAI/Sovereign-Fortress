/** Mirrors GET /api/msgf/health/pillars (MSGF HealthService). */

export type PillarStoplightStatus =
  | "green"
  | "yellow"
  | "yellow_self_healing"
  | "red"
  | "predicted";

export type MsgfGovernancePillar = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export type PillarHealthEntry = {
  pillar: MsgfGovernancePillar;
  label: string;
  status: PillarStoplightStatus;
  status_label: string;
  summary: string;
};

export type PillarHealthReport = {
  ok?: boolean;
  generated_at?: string;
  pillars: PillarHealthEntry[];
  overall_status?: PillarStoplightStatus;
};

export type StoplightAggregate = "green" | "yellow" | "red";

export function isYellowStatus(status: PillarStoplightStatus): boolean {
  return status === "yellow" || status === "yellow_self_healing" || status === "predicted";
}

export function isRedStatus(status: PillarStoplightStatus): boolean {
  return status === "red";
}

export function aggregateStoplight(report: PillarHealthReport): {
  tone: StoplightAggregate;
  degraded: PillarHealthEntry[];
  violations: PillarHealthEntry[];
} {
  const pillars = Array.isArray(report.pillars) ? report.pillars : [];
  const violations = pillars.filter((p) => isRedStatus(p.status));
  if (violations.length > 0) {
    return { tone: "red", degraded: [], violations };
  }

  const degraded = pillars.filter((p) => isYellowStatus(p.status));
  if (degraded.length > 0 || isYellowStatus(report.overall_status ?? "green")) {
    return { tone: "yellow", degraded, violations: [] };
  }

  return { tone: "green", degraded: [], violations: [] };
}
