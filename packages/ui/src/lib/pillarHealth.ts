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
  pending_incidents: number;
  recent_hall_events: number;
  recent_vault_events: number;
  self_healing_note: string | null;
  predicted_future_issue: boolean;
  summary: string;
};

export type LogicDriftTrendReport = {
  sample_count: number;
  last_scores: number[];
  trend: "stable" | "increasing" | "decreasing";
  slope: number;
  predicted_future_issue: boolean;
  escalation_threshold: number;
  predicted_stability_pct: number;
  predictive_pulse_horizon: number;
};

export type PillarHealthReport = {
  ok?: boolean;
  generated_at: string;
  scope: {
    user_id: string | null;
    global: boolean;
    dashboard_view?: "tenant_health" | "team_overview";
    company_id?: string | null;
    team_member_count?: number;
  };
  logic_drift: LogicDriftTrendReport;
  pillars: PillarHealthEntry[];
  overall_status: PillarStoplightStatus;
};

export type StoplightTone = "green" | "yellow" | "red" | "predictive";

export function mapPillarStatusToStoplightTone(status: PillarStoplightStatus): StoplightTone {
  switch (status) {
    case "green":
      return "green";
    case "yellow":
    case "yellow_self_healing":
      return "yellow";
    case "red":
      return "red";
    case "predicted":
      return "predictive";
    default:
      return "green";
  }
}

export function stoplightTitle(
  entry: PillarHealthEntry,
  predictiveTooltip?: string
): string {
  switch (entry.status) {
    case "green":
      return `${entry.pillar} — Stable. ${entry.summary}`;
    case "yellow_self_healing":
      return `${entry.pillar} — Self-Healing. ${entry.self_healing_note ?? entry.summary}`;
    case "yellow":
      return `${entry.pillar} — Caution. ${entry.summary}`;
    case "red":
      return `${entry.pillar} — Manual intervention required on the Dashboard. ${entry.summary}`;
    case "predicted":
      return `${entry.pillar} — ${predictiveTooltip ?? "Predicted future issue."} ${entry.summary}`;
    default:
      return entry.summary;
  }
}

export function formatPredictiveTooltip(
  logicDrift: LogicDriftTrendReport,
  horizon?: number
): string {
  const pulses = horizon ?? logicDrift.predictive_pulse_horizon ?? 50;
  const pct = logicDrift.predicted_stability_pct ?? 94;
  return `Predicted stability for next ${pulses} pulses: ${pct}% based on current trajectory.`;
}

export const PILLAR_ORDER: MsgfGovernancePillar[] = ["P1", "P2", "P3", "P4", "P5", "P6"];
