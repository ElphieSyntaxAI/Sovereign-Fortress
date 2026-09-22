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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Historical daily governance snapshots grouped by calendar day (user-scoped).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { allowMockTelemetry } from "@/lib/deploy-env";
import {
  hasLiveDashboardDatabaseEnv,
  transformDailyNetworkReport,
  type DailyNetworkReport,
  type TenantTelemetry24h,
} from "@/lib/services/dashboard-orchestration";
import {
  computeLogicDriftTrend,
  type PillarStoplightStatus,
} from "@/lib/services/HealthService";
import {
  MSGF_GOVERNANCE_PILLARS,
  type MsgfGovernancePillar,
} from "@/lib/services/pillar-baseline";
export type DailyReportPillarSnapshot = {
  pillar: MsgfGovernancePillar;
  label: string;
  status: PillarStoplightStatus;
  status_label: string;
  pending_incidents: number;
  hall_events: number;
};

export type DailyReportDaySnapshot = {
  /** Local calendar date `YYYY-MM-DD`. */
  date: string;
  generated_at: string;
  governance_summary: string;
  governance_status: "green" | "yellow" | "red";
  tokens_saved: number;
  stability_forecast_pct: number;
  logic_drift_label: string;
  logic_drift_slope: number;
  hall_events_total: number;
  incident_queue_total: number;
  pillars: DailyReportPillarSnapshot[];
  markdown?: string;
};

/** Events with no `metadata.project_origin` are bucketed here — never merged into mapped repos. */
export const DAILY_REPORTS_UNSCOPED_ORIGIN = "__unscoped__";
export const DAILY_REPORTS_UNSCOPED_LABEL = "Unmapped activity";

export type DailyReportsProjectScope = {
  project_origin: string;
  display_name: string;
};

export type DailyReportsProjectTimeline = DailyReportsProjectScope & {
  days: DailyReportDaySnapshot[];
};

const PILLAR_LABELS: Record<MsgfGovernancePillar, string> = {
  P1: "Static Ledger",
  P2: "Flow Sequence",
  P3: "Entity Profiles",
  P4: "Narrative Logs",
  P5: "Context Shard",
  P6: "Constraint Ledger",
};

type DayBucket = {
  narratives: Array<{
    severity?: string | null;
    metadata?: unknown;
    created_at: string;
  }>;
  incidents: Array<{
    status?: string | null;
    metadata?: unknown;
    bug_index?: unknown;
    updated_at: string;
  }>;
  tokens_saved: number;
  markdown?: string;
};

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readProjectOrigin(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const po = (metadata as Record<string, unknown>).project_origin;
  return typeof po === "string" && po.trim() ? po.trim() : null;
}

function resolveRowProjectOrigin(metadata: unknown, bugIndex?: unknown): string {
  return (
    readProjectOrigin(metadata) ??
    readProjectOrigin(bugIndex) ??
    DAILY_REPORTS_UNSCOPED_ORIGIN
  );
}

function rowBelongsToTimeline(
  resolvedOrigin: string,
  timelineOrigin: string,
  mappedOrigins: Set<string>
): boolean {
  if (resolvedOrigin !== DAILY_REPORTS_UNSCOPED_ORIGIN && !mappedOrigins.has(resolvedOrigin)) {
    return false;
  }
  if (timelineOrigin === DAILY_REPORTS_UNSCOPED_ORIGIN) {
    return resolvedOrigin === DAILY_REPORTS_UNSCOPED_ORIGIN;
  }
  return resolvedOrigin === timelineOrigin;
}

function timelineBucketKey(timelineOrigin: string, date: string): string {
  return `${timelineOrigin}\0${date}`;
}

function pillarFromMeta(meta: unknown): MsgfGovernancePillar {
  if (!meta || typeof meta !== "object") return "P4";
  const raw = String((meta as Record<string, unknown>).pillar ?? "P4").toUpperCase();
  if ((MSGF_GOVERNANCE_PILLARS as readonly string[]).includes(raw)) {
    return raw as MsgfGovernancePillar;
  }
  return "P4";
}

function numberFromMeta(meta: unknown, keys: string[]): number {
  if (!meta || typeof meta !== "object") return 0;
  const record = meta as Record<string, unknown>;
  for (const key of keys) {
    const raw = record[key];
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

function logicDriftLabel(trend: ReturnType<typeof computeLogicDriftTrend>["trend"]): string {
  if (trend === "increasing") return "Increasing drift";
  if (trend === "decreasing") return "Decreasing drift";
  return "Stable";
}

function statusLabel(status: PillarStoplightStatus): string {
  switch (status) {
    case "green":
      return "Green";
    case "yellow":
      return "Elevated";
    case "yellow_self_healing":
      return "Self-healing";
    case "red":
      return "Intervention";
    case "predicted":
      return "Predicted drift";
    default:
      return "Unknown";
  }
}

function buildPillarsForBucket(bucket: DayBucket): DailyReportPillarSnapshot[] {
  const pillarState = new Map<
    MsgfGovernancePillar,
    { pending: number; hall: number; violations: number; warnings: number }
  >();

  for (const p of MSGF_GOVERNANCE_PILLARS) {
    pillarState.set(p, { pending: 0, hall: 0, violations: 0, warnings: 0 });
  }

  for (const row of bucket.incidents) {
    const pillar = pillarFromMeta(row.metadata ?? row.bug_index);
    const state = pillarState.get(pillar)!;
    if (row.status === "pending" || row.status === "open") {
      state.pending += 1;
    }
  }

  for (const row of bucket.narratives) {
    const meta = row.metadata;
    const pillar = pillarFromMeta(meta);
    const state = pillarState.get(pillar)!;
    const record = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
    if (record.ledger === "hall" || row.severity === "Warning") {
      state.hall += 1;
      state.warnings += 1;
    }
    if (row.severity === "Violation") {
      state.violations += 1;
    }
  }

  return MSGF_GOVERNANCE_PILLARS.map((pillar) => {
    const counts = pillarState.get(pillar)!;
    let status: PillarStoplightStatus = "green";
    if (counts.violations > 0 || counts.pending > 2) status = "red";
    else if (counts.pending > 0 || counts.warnings > 0) status = "yellow";
    return {
      pillar,
      label: PILLAR_LABELS[pillar],
      status,
      status_label: statusLabel(status),
      pending_incidents: counts.pending,
      hall_events: counts.hall,
    };
  });
}

function finalizeDaySnapshot(date: string, bucket: DayBucket): DailyReportDaySnapshot {
  const pillars = buildPillarsForBucket(bucket);
  const incident_queue_total = pillars.reduce((s, p) => s + p.pending_incidents, 0);
  const hall_events_total = pillars.reduce((s, p) => s + p.hall_events, 0);
  const driftScores: number[] = [];

  for (const row of bucket.narratives) {
    const meta = row.metadata;
    if (!meta || typeof meta !== "object") continue;
    const raw = (meta as Record<string, unknown>).logic_drift_score;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (Number.isFinite(n)) driftScores.push(n <= 1 ? n : n / 100);
  }

  const drift = computeLogicDriftTrend(driftScores);
  const tokensFromNarratives = bucket.narratives.reduce(
    (sum, row) => sum + numberFromMeta(row.metadata, ["tokens_saved", "token_compute_saved_by_p5"]),
    0
  );
  const tokens_saved = bucket.tokens_saved || tokensFromNarratives;

  let governance_status: DailyReportDaySnapshot["governance_status"] = "green";
  if (pillars.some((p) => p.status === "red") || incident_queue_total > 2) {
    governance_status = "red";
  } else if (pillars.some((p) => p.status !== "green") || incident_queue_total > 0) {
    governance_status = "yellow";
  }

  const governance_summary =
    incident_queue_total > 0
      ? `${incident_queue_total} Incident${incident_queue_total === 1 ? "" : "s"}`
      : governance_status === "green"
        ? "All Pillars Nominal"
        : "Elevated watch";

  const latestTs =
    [...bucket.narratives.map((n) => n.created_at), ...bucket.incidents.map((i) => i.updated_at)]
      .sort()
      .pop() ?? `${date}T23:59:59.000Z`;

  return {
    date,
    generated_at: latestTs,
    governance_summary,
    governance_status,
    tokens_saved,
    stability_forecast_pct: drift.predicted_stability_pct ?? 94,
    logic_drift_label: logicDriftLabel(drift.trend),
    logic_drift_slope: drift.slope,
    hall_events_total,
    incident_queue_total,
    pillars,
    markdown: bucket.markdown,
  };
}

export function snapshotFromDailyNetworkReport(report: DailyNetworkReport): DailyReportDaySnapshot {
  const date = localDateKey(report.generated_at);
  const tokens_saved = report.financial_overhead_summary.total_token_compute_saved_by_p5;
  const drift = computeLogicDriftTrend(
    report.repository_health_grid.flatMap(() => [report.governance_integrity_metrics.global_logic_drift_slope])
  );

  const pillars: DailyReportPillarSnapshot[] = MSGF_GOVERNANCE_PILLARS.map((pillar, index) => {
    const row = report.repository_health_grid[index % report.repository_health_grid.length];
    let status: PillarStoplightStatus = "green";
    if (row?.hard_failures && row.hard_failures > 0) status = "red";
    else if (row && (row.anomalies > 0 || row.status === "yellow")) status = "yellow";
    else if (row?.status === "red") status = "red";
    return {
      pillar,
      label: PILLAR_LABELS[pillar],
      status,
      status_label: statusLabel(status),
      pending_incidents: row?.hard_failures ?? 0,
      hall_events: row?.anomalies ?? 0,
    };
  });

  const incident_queue_total = report.governance_integrity_metrics.total_anomalies;
  const hall_events_total = pillars.reduce((s, p) => s + p.hall_events, 0);

  return {
    date,
    generated_at: report.generated_at,
    governance_summary:
      incident_queue_total > 0
        ? `${incident_queue_total} Anomalies`
        : "All Pillars Nominal",
    governance_status:
      pillars.some((p) => p.status === "red")
        ? "red"
        : pillars.some((p) => p.status !== "green")
          ? "yellow"
          : "green",
    tokens_saved,
    stability_forecast_pct: drift.predicted_stability_pct ?? 94,
    logic_drift_label: logicDriftLabel(drift.trend),
    logic_drift_slope: report.governance_integrity_metrics.global_logic_drift_slope,
    hall_events_total,
    incident_queue_total,
    pillars,
    markdown: report.markdown,
  };
}

function projectMockSeed(projectOrigin: string): number {
  return projectOrigin.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function mockTenantNameForProject(
  displayName: string,
  projectOrigin: string
): TenantTelemetry24h["tenant_name"] {
  const raw = `${displayName} ${projectOrigin}`.toLowerCase();
  if (raw.includes("education") || raw.includes("syntax")) return "Syntax Education";
  if (raw.includes("author")) return "Author Ecosystem";
  return "Client Projects";
}

export function buildMockDailyReportsHistoryForProject(
  project: DailyReportsProjectScope,
  lookbackDays = 45
): DailyReportDaySnapshot[] {
  const today = new Date();
  const days: DailyReportDaySnapshot[] = [];
  const seed = projectMockSeed(project.project_origin);

  for (let offset = 0; offset < lookbackDays; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const date = localDateKey(d.toISOString());
    const phase = (offset + seed) % 13;
    const telemetry = transformDailyNetworkReport(
      [
        {
          tenant_name: mockTenantNameForProject(
            project.display_name,
            project.project_origin
          ),
          status: phase % 7 === 0 ? "yellow" : "green",
          token_compute_processed: 120_000 + offset * 800 + (seed % 40_000),
          token_compute_saved_by_p5: 18_000 + offset * 120 + (seed % 5_000),
          anomaly_count: phase % 5 === 0 ? 2 : 0,
          self_healed_count: 1,
          hard_failure_count: phase % 11 === 0 ? 1 : 0,
          logic_drift_scores: [0.1 + (phase % 10) * 0.02],
        },
      ],
      d.toISOString()
    );
    const snap = snapshotFromDailyNetworkReport(telemetry);
    days.push({ ...snap, date, generated_at: d.toISOString() });
  }

  return days;
}

function finalizeBucketsForTimeline(
  buckets: Map<string, DayBucket>,
  timelineOrigin: string
): DailyReportDaySnapshot[] {
  const prefix = `${timelineOrigin}\0`;
  const snapshots = [...buckets.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, bucket]) => {
      const date = key.slice(prefix.length);
      if (!bucket.tokens_saved && bucket.narratives.length) {
        const saved = bucket.narratives.reduce(
          (sum, n) => sum + numberFromMeta(n.metadata, ["tokens_saved", "p5_tokens_saved"]),
          0
        );
        bucket.tokens_saved = saved;
      }
      return finalizeDaySnapshot(date, bucket);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return snapshots;
}

function ingestRowsIntoBuckets(
  buckets: Map<string, DayBucket>,
  mappedOrigins: Set<string>,
  timelineOrigins: string[],
  narratives: Array<{
    severity?: string | null;
    metadata?: unknown;
    created_at: string;
    action_type?: string | null;
  }>,
  incidents: Array<{
    status?: string | null;
    metadata?: unknown;
    bug_index?: unknown;
    updated_at: string;
  }>
): void {
  const ensure = (timelineOrigin: string, date: string): DayBucket => {
    const key = timelineBucketKey(timelineOrigin, date);
    let b = buckets.get(key);
    if (!b) {
      b = { narratives: [], incidents: [], tokens_saved: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  for (const row of narratives) {
    const resolved = resolveRowProjectOrigin(row.metadata);
    const date = localDateKey(String(row.created_at));
    for (const timelineOrigin of timelineOrigins) {
      if (!rowBelongsToTimeline(resolved, timelineOrigin, mappedOrigins)) continue;
      const bucket = ensure(timelineOrigin, date);
      bucket.narratives.push({
        severity: row.severity as string | null,
        metadata: row.metadata,
        created_at: String(row.created_at),
      });
      if (row.action_type === "P5_ECO_DAILY_DIGEST") {
        const saved = numberFromMeta(row.metadata, [
          "token_compute_saved_by_p5",
          "tokens_saved",
        ]);
        bucket.tokens_saved = Math.max(bucket.tokens_saved, saved);
        const meta = row.metadata;
        if (meta && typeof meta === "object") {
          const md = (meta as Record<string, unknown>).markdown;
          if (typeof md === "string") bucket.markdown = md;
        }
      }
    }
  }

  for (const row of incidents) {
    const resolved = resolveRowProjectOrigin(row.metadata, row.bug_index);
    const date = localDateKey(String(row.updated_at));
    for (const timelineOrigin of timelineOrigins) {
      if (!rowBelongsToTimeline(resolved, timelineOrigin, mappedOrigins)) continue;
      ensure(timelineOrigin, date).incidents.push({
        status: row.status as string | null,
        metadata: row.metadata,
        bug_index: row.bug_index,
        updated_at: String(row.updated_at),
      });
    }
  }
}

/**
 * Per-mapped-repo daily timelines. Narratives/incidents are never merged across `project_origin` tags.
 */
export async function fetchDailyReportsHistoryByProject(
  admin: SupabaseClient,
  userId: string,
  projects: DailyReportsProjectScope[],
  lookbackDays = 120
): Promise<DailyReportsProjectTimeline[]> {
  const mapped = projects
    .map((p) => ({
      project_origin: p.project_origin.trim(),
      display_name: p.display_name.trim() || p.project_origin,
    }))
    .filter((p) => p.project_origin.length > 0);

  const mappedOrigins = new Set(mapped.map((p) => p.project_origin));
  const timelineOrigins = [...mappedOrigins, DAILY_REPORTS_UNSCOPED_ORIGIN];

  if (!hasLiveDashboardDatabaseEnv()) {
    if (!allowMockTelemetry()) {
      return mapped.map((p) => ({ ...p, days: [] }));
    }
    const mockDays = Math.min(lookbackDays, 60);
    const timelines: DailyReportsProjectTimeline[] = mapped.map((p) => ({
      ...p,
      days: buildMockDailyReportsHistoryForProject(p, mockDays),
    }));
    return timelines;
  }

  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const [narrativesRes, incidentsRes] = await Promise.all([
    admin
      .from("p4_narrative_logs")
      .select("severity, metadata, created_at, action_type")
      .eq("actor_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("msgf_incidents")
      .select("status, metadata, bug_index, updated_at")
      .eq("user_id", userId)
      .gte("updated_at", since.toISOString())
      .order("updated_at", { ascending: false })
      .limit(800),
  ]);

  const buckets = new Map<string, DayBucket>();
  ingestRowsIntoBuckets(
    buckets,
    mappedOrigins,
    timelineOrigins,
    (narrativesRes.data ?? []).map((row) => ({
      severity: row.severity as string | null,
      metadata: row.metadata,
      created_at: String(row.created_at),
      action_type: row.action_type as string | null,
    })),
    (incidentsRes.data ?? []).map((row) => ({
      status: row.status as string | null,
      metadata: row.metadata,
      bug_index: row.bug_index,
      updated_at: String(row.updated_at),
    }))
  );

  const timelines: DailyReportsProjectTimeline[] = mapped.map((p) => ({
    project_origin: p.project_origin,
    display_name: p.display_name,
    days: finalizeBucketsForTimeline(buckets, p.project_origin),
  }));

  const unscopedDays = finalizeBucketsForTimeline(buckets, DAILY_REPORTS_UNSCOPED_ORIGIN);
  if (unscopedDays.length > 0) {
    timelines.push({
      project_origin: DAILY_REPORTS_UNSCOPED_ORIGIN,
      display_name: DAILY_REPORTS_UNSCOPED_LABEL,
      days: unscopedDays,
    });
  }

  return timelines;
}
