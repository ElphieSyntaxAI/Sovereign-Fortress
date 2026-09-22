/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Six-pillar stoplight health — incidents + narrative logs + logic drift trend.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  GenealogicalBugIndexSchema,
  PULSE_BUG_INDEX,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import {
  MSGF_GOVERNANCE_PILLARS,
  type MsgfGovernancePillar,
} from "@/lib/services/pillar-baseline";
import { LOGIC_DRIFT_ESCALATION_THRESHOLD } from "@/lib/services/logic-drift";

/** Stoplight color / state for dashboard and Author App. */
export type PillarStoplightStatus =
  | "green"
  | "yellow"
  | "yellow_self_healing"
  | "red"
  | "predicted";

export type LogicDriftTrend = "stable" | "increasing" | "decreasing";

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
  latest_events: PillarHealthEvent[];
};

export type PillarHealthEvent = {
  id: string;
  kind: "incident" | "vault" | "hall" | "narrative";
  title: string;
  summary: string;
  status?: string | null;
  severity?: string | null;
  created_at: string;
  bug_index: GenealogicalBugIndex;
};

export const PREDICTIVE_PULSE_HORIZON = 50;

export type LogicDriftTrendReport = {
  sample_count: number;
  last_scores: number[];
  trend: LogicDriftTrend;
  slope: number;
  predicted_future_issue: boolean;
  escalation_threshold: number;
  /** Projected stability % over the next {@link PREDICTIVE_PULSE_HORIZON} pulses. */
  predicted_stability_pct: number;
  predictive_pulse_horizon: number;
};

export type PillarHealthReport = {
  generated_at: string;
  scope: {
    user_id: string | null;
    global: boolean;
    /** Set for company-operator dashboard aggregation. */
    dashboard_view?: "tenant_health" | "team_overview";
    company_id?: string | null;
    team_member_count?: number;
    /** When set, telemetry is limited to these `project_origin` tags (mapped repos). */
    project_origins?: string[];
  };
  logic_drift: LogicDriftTrendReport;
  pillars: PillarHealthEntry[];
  overall_status: PillarStoplightStatus;
};

export type HealthServiceOptions = {
  /** Filter telemetry to one author; omit for tenant-wide ops view. */
  userId?: string | null;
  /** Aggregate telemetry for many authors (company team view). */
  memberUserIds?: string[] | null;
  companyId?: string | null;
  dashboardView?: "tenant_health" | "team_overview";
  /** When true with empty `memberUserIds`, aggregate an empty team (never global). */
  teamScope?: boolean;
  /** Hours of narrative/incident lookback (default 168 = 7d). */
  lookbackHours?: number;
  /** Self-healing LOM resolution window (default 72h). */
  selfHealingHours?: number;
  /** Pulse samples for drift trend (default 10). */
  driftSampleSize?: number;
  /** Limit rows to these mapped repository tags (personal dashboard). */
  projectOrigins?: string[];
};

const PILLAR_LABELS: Record<MsgfGovernancePillar, string> = {
  P1: "Universal HAL / DEFEND",
  P2: "P2 Roadmap / CROSS-REF",
  P3: "Stylometry / Linguistic",
  P4: "State Ledger / SHARD",
  P5: "Core / SWEEP",
  P6: "RAG / Vault–Hall",
};

const LOM_RECURSION_INSTANCE = PULSE_BUG_INDEX.hallLomRecursion.level_1_1_1_instance;

const STATUS_LABELS: Record<PillarStoplightStatus, string> = {
  green: "Green",
  yellow: "Yellow",
  yellow_self_healing: "Yellow (Self-Healing)",
  red: "Red",
  predicted: "Predicted Future Issue",
};

type IncidentRow = {
  id: string;
  user_id: string;
  status: string;
  bug_index: unknown;
  metadata?: unknown;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

type NarrativeRow = {
  id: string;
  actor_id: string | null;
  action_type?: string | null;
  message?: string | null;
  severity: string | null;
  created_at: string;
  metadata: unknown;
};

type BeatRow = {
  author_id: string;
  created_at: string;
  metadata: unknown;
};

function parseBugIndex(raw: unknown): GenealogicalBugIndex | null {
  const parsed = GenealogicalBugIndexSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function readProjectOrigin(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const po = (metadata as Record<string, unknown>).project_origin;
  return typeof po === "string" && po.trim() ? po.trim() : null;
}

function rowMatchesProjectOrigins(
  metadata: unknown,
  origins: Set<string> | null
): boolean {
  if (!origins || origins.size === 0) return true;
  const po = readProjectOrigin(metadata);
  return po != null && origins.has(po);
}

/**
 * Maps genealogical branch/instance to governance pillar P1–P6.
 */
export function bugIndexToGovernancePillar(
  bugIndex: GenealogicalBugIndex
): MsgfGovernancePillar {
  const branch = bugIndex.level_1_1_branch.toUpperCase();
  const instance = bugIndex.level_1_1_1_instance.toUpperCase();

  if (branch.includes("DEFEND") || instance.includes("SHADOW")) return "P1";
  if (
    branch.includes("AUTHENTICITY") ||
    (branch.includes("HAL") && !instance.includes("STATE_LEDGER"))
  ) {
    return "P1";
  }
  if (
    branch.includes("CROSSREF") ||
    branch.includes("CROSS-REF") ||
    instance.includes("P2_EDUCATION")
  ) {
    return "P2";
  }
  if (instance.includes("LOM_MODEL") || branch.includes("CONVERGE")) {
    return instance.includes("LOM") ? "P1" : "P6";
  }
  if (
    branch.includes("ARBITRATE") ||
    branch.includes("SHARD") ||
    branch.includes("FLOW") ||
    instance.includes("STATE_LEDGER")
  ) {
    return "P4";
  }
  if (branch.includes("SELF_HEAL") || instance.includes("USER_SENTINEL")) {
    return "P4";
  }
  if (branch.includes("SWEEP")) return "P5";
  if (branch.includes("PERSIST")) return "P6";
  return "P6";
}

export function isAutomaticLomResolution(resolutionNote: string | null): boolean {
  const note = (resolutionNote ?? "").toLowerCase();
  if (!note) return false;
  return (
    /\bauto(?:matic(?:ally)?)?\b/.test(note) ||
    /self[- ]?heal/.test(note) ||
    note.includes("[auto]") ||
    note.includes("system resolved") ||
    note.includes("lom guard recovered") ||
    note.includes("self-healing")
  );
}

function extractDriftScore(metadata: unknown): number | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const raw = m.logic_drift_score;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw <= 1 ? raw : raw / 100;
  }
  if (m.ledger === "hall") return 0.55;
  if (m.ledger === "vault" && m.pulse_engine === true) return 0.12;
  if (m.beat_kind === "local_state") return 0.15;
  return null;
}

function compactBugIndexLabel(bugIndex: GenealogicalBugIndex): string {
  return bugIndex.level_1_1_1_instance.replace(/_/g, " ");
}

function eventTimeMs(event: PillarHealthEvent): number {
  const ms = new Date(event.created_at).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Projected Brain stability from latest drift + slope over N future pulses. */
export function computePredictedStabilityPct(
  drift: Pick<LogicDriftTrendReport, "last_scores" | "slope">,
  horizon = PREDICTIVE_PULSE_HORIZON
): number {
  const last =
    drift.last_scores[0] ??
    drift.last_scores[drift.last_scores.length - 1] ??
    0.15;
  const projected = Math.min(1, Math.max(0, last + drift.slope * horizon));
  return Math.max(5, Math.min(99, Math.round((1 - projected) * 100)));
}

export function formatPredictiveStabilityTooltip(
  drift: Pick<
    LogicDriftTrendReport,
    | "predicted_stability_pct"
    | "predictive_pulse_horizon"
    | "trend"
    | "slope"
    | "last_scores"
  >
): string {
  const horizon = drift.predictive_pulse_horizon ?? PREDICTIVE_PULSE_HORIZON;
  const pct =
    drift.predicted_stability_pct ??
    computePredictedStabilityPct(
      { last_scores: drift.last_scores, slope: drift.slope },
      horizon
    );
  return `Predicted stability for next ${horizon} pulses: ${pct}% based on current trajectory.`;
}

export function computeLogicDriftTrend(
  scores: number[],
  options?: { minSamples?: number; slopeThreshold?: number }
): LogicDriftTrendReport {
  const minSamples = options?.minSamples ?? 3;
  const slopeThreshold = options?.slopeThreshold ?? 0.025;

  if (scores.length === 0) {
    const empty: LogicDriftTrendReport = {
      sample_count: 0,
      last_scores: [],
      trend: "stable",
      slope: 0,
      predicted_future_issue: false,
      escalation_threshold: LOGIC_DRIFT_ESCALATION_THRESHOLD,
      predicted_stability_pct: 94,
      predictive_pulse_horizon: PREDICTIVE_PULSE_HORIZON,
    };
    return empty;
  }

  const chronological = [...scores].reverse();
  const n = chronological.length;
  const meanX = (n - 1) / 2;
  const meanY = chronological.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - meanX) * (chronological[i]! - meanY);
    denominator += (i - meanX) ** 2;
  }

  const slope = denominator > 0 ? numerator / denominator : 0;
  const last = chronological[n - 1] ?? 0;

  let trend: LogicDriftTrend = "stable";
  if (slope > slopeThreshold) trend = "increasing";
  else if (slope < -slopeThreshold) trend = "decreasing";

  const predicted_future_issue =
    n >= minSamples &&
    trend === "increasing" &&
    slope > slopeThreshold &&
    last >= LOGIC_DRIFT_ESCALATION_THRESHOLD * 0.85;

  const report: LogicDriftTrendReport = {
    sample_count: n,
    last_scores: scores,
    trend,
    slope: Math.round(slope * 1000) / 1000,
    predicted_future_issue,
    escalation_threshold: LOGIC_DRIFT_ESCALATION_THRESHOLD,
    predicted_stability_pct: 0,
    predictive_pulse_horizon: PREDICTIVE_PULSE_HORIZON,
  };
  report.predicted_stability_pct = computePredictedStabilityPct(report);
  return report;
}

type HealthScopeFilter =
  | { mode: "global" }
  | { mode: "user"; userId: string }
  | { mode: "team"; userIds: string[] };

function worstStatus(
  current: PillarStoplightStatus,
  next: PillarStoplightStatus
): PillarStoplightStatus {
  const rank: Record<PillarStoplightStatus, number> = {
    green: 0,
    yellow: 1,
    yellow_self_healing: 2,
    predicted: 3,
    red: 4,
  };
  return rank[next] > rank[current] ? next : current;
}

export class HealthService {
  async getPillarHealth(
    supabase: SupabaseClient,
    options: HealthServiceOptions = {}
  ): Promise<PillarHealthReport> {
    const teamScope = options.teamScope === true;
    const memberIdsRaw = options.memberUserIds?.filter((id) => id?.trim()) ?? [];
    const userId = options.userId?.trim() || null;
    const lookbackHours = options.lookbackHours ?? 168;
    const selfHealingHours = options.selfHealingHours ?? 72;
    const driftSampleSize = options.driftSampleSize ?? 10;
    const companyId = options.companyId?.trim() || null;
    const dashboardView = options.dashboardView;
    const projectOriginsRaw = options.projectOrigins?.map((o) => o.trim()).filter(Boolean) ?? [];
    const projectOriginSet =
      projectOriginsRaw.length > 0 ? new Set(projectOriginsRaw) : null;

    const now = new Date();
    const lookbackFrom = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
    const selfHealFrom = new Date(now.getTime() - selfHealingHours * 60 * 60 * 1000);

    let scopeFilter: HealthScopeFilter;
    let scope: PillarHealthReport["scope"];

    if (teamScope || memberIdsRaw.length > 0) {
      scopeFilter = { mode: "team", userIds: memberIdsRaw };
      scope = {
        user_id: userId,
        global: false,
        dashboard_view: dashboardView ?? "team_overview",
        company_id: companyId,
        team_member_count: memberIdsRaw.length,
      };
    } else if (userId) {
      scopeFilter = { mode: "user", userId };
      scope = {
        user_id: userId,
        global: false,
        dashboard_view: dashboardView,
        company_id: companyId,
        ...(projectOriginsRaw.length > 0
          ? { project_origins: projectOriginsRaw }
          : {}),
      };
    } else {
      scopeFilter = { mode: "global" };
      scope = {
        user_id: null,
        global: true,
        dashboard_view: dashboardView ?? "tenant_health",
      };
    }

    if (scopeFilter.mode === "team" && scopeFilter.userIds.length === 0) {
      const logicDrift = computeLogicDriftTrend([]);
      const pillars: PillarHealthEntry[] = MSGF_GOVERNANCE_PILLARS.map((pillar) => ({
        pillar,
        label: PILLAR_LABELS[pillar],
        status: "green",
        status_label: STATUS_LABELS.green,
        pending_incidents: 0,
        recent_hall_events: 0,
        recent_vault_events: 0,
        self_healing_note: null,
        predicted_future_issue: false,
        summary: `${PILLAR_LABELS[pillar]} — no profiles in company scope.`,
        latest_events: [],
      }));
      return {
        generated_at: now.toISOString(),
        scope,
        logic_drift: logicDrift,
        pillars,
        overall_status: "green",
      };
    }

    const beatLimit = scopeFilter.mode === "team" ? Math.max(driftSampleSize * 8, 64) : driftSampleSize;

    let [incidents, narratives, beats] = await Promise.all([
      this.fetchIncidentsScoped(supabase, scopeFilter, lookbackFrom),
      this.fetchNarrativesScoped(supabase, scopeFilter, lookbackFrom),
      this.fetchPulseBeatsScoped(supabase, scopeFilter, beatLimit),
    ]);

    if (projectOriginSet) {
      incidents = incidents.filter((row) => rowMatchesProjectOrigins(row.metadata, projectOriginSet));
      narratives = narratives.filter((row) => rowMatchesProjectOrigins(row.metadata, projectOriginSet));
      beats = beats.filter((row) => rowMatchesProjectOrigins(row.metadata, projectOriginSet));
    }

    const driftScores: number[] = [];
    for (const beat of beats) {
      const score = extractDriftScore(beat.metadata);
      if (score != null) driftScores.push(score);
    }
    for (const row of narratives.slice(0, driftSampleSize * 2)) {
      const score = extractDriftScore(row.metadata);
      if (score != null && driftScores.length < driftSampleSize * 2) {
        driftScores.push(score);
      }
    }
    const trimmedDrift = driftScores.slice(0, driftSampleSize);
    const logicDrift = computeLogicDriftTrend(trimmedDrift);

    const pillarState = new Map<
      MsgfGovernancePillar,
      {
        pending: number;
        hall: number;
        vault: number;
        selfHealingNote: string | null;
        warnings: number;
        events: PillarHealthEvent[];
      }
    >();

    for (const p of MSGF_GOVERNANCE_PILLARS) {
      pillarState.set(p, {
        pending: 0,
        hall: 0,
        vault: 0,
        selfHealingNote: null,
        warnings: 0,
        events: [],
      });
    }

    for (const incident of incidents) {
      const bugIndex = parseBugIndex(incident.bug_index);
      if (!bugIndex) continue;
      const pillar = bugIndexToGovernancePillar(bugIndex);
      const state = pillarState.get(pillar)!;

      if (incident.status === "pending") {
        state.pending += 1;
      }

      state.events.push({
        id: incident.id,
        kind: "incident",
        title:
          incident.status === "pending"
            ? "Pending ARBITRATE incident"
            : `Incident ${incident.status}`,
        summary: compactBugIndexLabel(bugIndex),
        status: incident.status,
        created_at: incident.updated_at || incident.created_at,
        bug_index: bugIndex,
      });

      if (incident.status === "pending") continue;

      if (
        bugIndex.level_1_1_1_instance === LOM_RECURSION_INSTANCE &&
        new Date(incident.updated_at) >= selfHealFrom &&
        isAutomaticLomResolution(incident.resolution_note)
      ) {
        state.selfHealingNote =
          incident.resolution_note?.trim() ||
          "LOM recursion auto-resolved by system guard.";
      }
    }

    for (const row of narratives) {
      const meta = row.metadata as Record<string, unknown> | null;
      const bugRaw = meta?.bug_index ?? (meta?.vault_hall as Record<string, unknown>)?.bug_index;
      const bugIndex = parseBugIndex(bugRaw);
      if (!bugIndex) continue;

      const pillar = bugIndexToGovernancePillar(bugIndex);
      const state = pillarState.get(pillar)!;
      const ledger = meta?.ledger;

      if (ledger === "hall") {
        state.hall += 1;
        if (row.severity === "Violation") state.warnings += 2;
        else if (row.severity === "Warning") state.warnings += 1;
      } else if (ledger === "vault") {
        state.vault += 1;
      }

      const kind =
        ledger === "vault"
          ? "vault"
          : ledger === "hall"
            ? "hall"
            : "narrative";
      state.events.push({
        id: row.id,
        kind,
        title:
          kind === "vault"
            ? "Vault change"
            : kind === "hall"
              ? "Hall issue"
              : row.action_type || "Narrative event",
        summary:
          row.message?.trim() ||
          compactBugIndexLabel(bugIndex),
        severity: row.severity,
        created_at: row.created_at,
        bug_index: bugIndex,
      });
    }

    const pillars: PillarHealthEntry[] = MSGF_GOVERNANCE_PILLARS.map((pillar) => {
      const state = pillarState.get(pillar)!;
      let status: PillarStoplightStatus = "green";
      let summary = `${PILLAR_LABELS[pillar]} operating normally.`;

      if (state.pending > 0) {
        status = "red";
        summary = `${state.pending} pending ARBITRATE incident(s).`;
      } else if (state.selfHealingNote) {
        status = "yellow_self_healing";
        summary = "Recent automatic LOM recursion recovery.";
      } else if (logicDrift.predicted_future_issue) {
        status = "predicted";
        summary = `Logic drift trending ${logicDrift.trend} (slope ${logicDrift.slope}).`;
      } else if (state.warnings > 0 || state.hall > 3) {
        status = "yellow";
        summary = `${state.hall} recent Hall event(s); elevated watch.`;
      }

      return {
        pillar,
        label: PILLAR_LABELS[pillar],
        status,
        status_label: STATUS_LABELS[status],
        pending_incidents: state.pending,
        recent_hall_events: state.hall,
        recent_vault_events: state.vault,
        self_healing_note: state.selfHealingNote,
        predicted_future_issue:
          status === "predicted" || logicDrift.predicted_future_issue,
        summary,
        latest_events: state.events.sort((a, b) => eventTimeMs(b) - eventTimeMs(a)).slice(0, 8),
      };
    });

    let overall_status: PillarStoplightStatus = "green";
    for (const p of pillars) {
      overall_status = worstStatus(overall_status, p.status);
    }

    return {
      generated_at: now.toISOString(),
      scope,
      logic_drift: logicDrift,
      pillars,
      overall_status,
    };
  }

  private async fetchIncidentsScoped(
    supabase: SupabaseClient,
    filter: HealthScopeFilter,
    since: Date
  ): Promise<IncidentRow[]> {
    let q = supabase
      .from("msgf_incidents")
      .select("id, user_id, status, bug_index, metadata, resolution_note, created_at, updated_at")
      .gte("updated_at", since.toISOString());

    if (filter.mode === "user") {
      q = q.eq("user_id", filter.userId);
    } else if (filter.mode === "team") {
      q = q.in("user_id", filter.userIds);
    }

    const { data, error } = await q.order("updated_at", { ascending: false }).limit(400);
    if (error) {
      console.warn("[HealthService] msgf_incidents:", error.message);
      return [];
    }
    return (data ?? []) as IncidentRow[];
  }

  private async fetchNarrativesScoped(
    supabase: SupabaseClient,
    filter: HealthScopeFilter,
    since: Date
  ): Promise<NarrativeRow[]> {
    let q = supabase
      .from("p4_narrative_logs")
      .select("id, actor_id, action_type, message, severity, created_at, metadata")
      .gte("created_at", since.toISOString());

    if (filter.mode === "user") {
      q = q.eq("actor_id", filter.userId);
    } else if (filter.mode === "team") {
      q = q.in("actor_id", filter.userIds);
    }

    const { data, error } = await q.order("created_at", { ascending: false }).limit(400);
    if (error) {
      console.warn("[HealthService] p4_narrative_logs:", error.message);
      return [];
    }
    return (data ?? []) as NarrativeRow[];
  }

  private async fetchPulseBeatsScoped(
    supabase: SupabaseClient,
    filter: HealthScopeFilter,
    limit: number
  ): Promise<BeatRow[]> {
    let q = supabase
      .from("state_beats")
      .select("author_id, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filter.mode === "user") {
      q = q.eq("author_id", filter.userId);
    } else if (filter.mode === "team") {
      q = q.in("author_id", filter.userIds);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("[HealthService] state_beats:", error.message);
      return [];
    }
    return (data ?? []) as BeatRow[];
  }
}

export const healthService = new HealthService();
