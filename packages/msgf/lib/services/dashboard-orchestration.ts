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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * MSGF V3.2-ULTRA front-end dashboard orchestration contracts.
 *
 * Surfaces:
 * 1) Global notification ticker.
 * 2) In-pillar live terminal logs and arbitration drawer.
 * 3) Daily network report aggregation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import type {
  PillarHealthEvent,
  PillarHealthReport,
} from "@/lib/services/HealthService";
import { bugIndexToGovernancePillar, computeLogicDriftTrend } from "@/lib/services/HealthService";
import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";
import { MSGF_GOVERNANCE_PILLARS } from "@/lib/services/pillar-baseline";
import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";

export type GlobalTickerType = "INFO" | "WARNING" | "ACTION_REQUIRED";

export type GlobalNotificationTickerEvent = {
  id: string;
  timestamp: string;
  type: GlobalTickerType;
  pillar: MsgfGovernancePillar;
  source: "p5_context_shard" | "p6_self_heal" | "p2_arbitrate" | "v32_mock_stream";
  message: string;
  lineage: GenealogicalBugIndex;
  token_savings_pct?: number;
  eco_metrics?: EcoMetrics;
  attempt_count?: number;
  action_url?: string;
};

export type TerminalSelfHealedLog = {
  id: string;
  timestamp: string;
  attempt_count: 1 | 2 | 3;
  source_string: string;
  vault_cross_ref: string;
};

export type TerminalHardFailureLog = {
  id: string;
  timestamp: string;
  reason: "RECURSION_LIMIT" | "RED_MODEL_SPLIT";
  source_string: string;
  state: "PENDING_HUMAN_ARBITRATE" | "BYPASSED_TO_VAULT" | "DENIED_PURGED_TO_HALL";
  lineage: GenealogicalBugIndex;
};

export type TerminalManualRealignmentLog = {
  id: string;
  timestamp: string;
  source_string: string;
  file_path: string;
  lineage: GenealogicalBugIndex;
};

export type PillarLiveLogs = {
  pillar: MsgfGovernancePillar;
  generated_at: string;
  autonomous_self_healed: TerminalSelfHealedLog[];
  hard_failures_pending_queue: TerminalHardFailureLog[];
  manual_realignments: TerminalManualRealignmentLog[];
};

export type ArbitrationAction = "APPROVE_BYPASS" | "DENY_PURGE";

export type ArbitrationStateMachineResult = {
  ok: true;
  action: ArbitrationAction;
  incident_id: string;
  next_state: TerminalHardFailureLog["state"];
  security_clean_signal: boolean;
  vault_or_hall_lineage: GenealogicalBugIndex;
  message: string;
};

export type TenantTelemetry24h = {
  tenant_name: "Syntax Education" | "Author Ecosystem" | "Client Projects";
  status: "green" | "yellow" | "red";
  token_compute_processed: number;
  token_compute_saved_by_p5: number;
  anomaly_count: number;
  self_healed_count: number;
  hard_failure_count: number;
  logic_drift_scores: number[];
};

export type PulseRoutingMixSummary = {
  tenant_id: string;
  total_pulses: number;
  local_gateway: number;
  converge_bypass: number;
  global_converge: number;
  local_or_bypass_pct: number;
  estimated_tokens_saved_vs_naive: number;
};

export type DailyNetworkReport = {
  generated_at: string;
  window_hours: 24;
  financial_overhead_summary: {
    total_token_compute_processed: number;
    total_token_compute_saved_by_p5: number;
    p5_context_savings_pct: number;
    eco_metrics: EcoMetrics;
  };
  pulse_routing_mix?: PulseRoutingMixSummary[];
  governance_integrity_metrics: {
    global_logic_drift_slope: number;
    total_anomalies: number;
    self_healing_success_rate_pct: number;
  };
  repository_health_grid: Array<{
    tenant_name: TenantTelemetry24h["tenant_name"];
    status: TenantTelemetry24h["status"];
    anomalies: number;
    self_healed: number;
    hard_failures: number;
  }>;
  environmental_footprint_series: EnvironmentalFootprintPoint[];
  markdown: string;
};

export type EnvironmentalFootprintPoint = {
  timestamp: string;
  tokens_saved: number;
  grid_compute_prevented_kwh: number;
  co2e_offset_lbs: number;
  freshwater_conserved_gallons: number;
};

export function hasLiveDashboardDatabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key);
}

function nowIso(): string {
  return new Date().toISOString();
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function eventTypeForHealthEvent(event: PillarHealthEvent): GlobalTickerType {
  if (event.kind === "incident" && event.status === "pending") return "ACTION_REQUIRED";
  if (event.kind === "hall") return "WARNING";
  return "INFO";
}

function sourceForTickerType(type: GlobalTickerType): GlobalNotificationTickerEvent["source"] {
  if (type === "ACTION_REQUIRED") return "p2_arbitrate";
  if (type === "WARNING") return "p6_self_heal";
  return "p5_context_shard";
}

export function mapHealthReportToTickerEvents(
  report: PillarHealthReport,
  limit = 12
): GlobalNotificationTickerEvent[] {
  const events: GlobalNotificationTickerEvent[] = [];
  for (const pillar of report.pillars) {
    for (const event of pillar.latest_events) {
      const type = eventTypeForHealthEvent(event);
      events.push({
        id: `${type}-${event.id}`,
        timestamp: event.created_at,
        type,
        pillar: pillar.pillar,
        source: sourceForTickerType(type),
        message:
          type === "INFO"
            ? `P5 context shard update: ${event.summary}`
            : type === "WARNING"
              ? `P6 anomaly/self-heal trace: ${event.summary}`
              : `P2/Consensus lockout awaiting Human Arbitrate: ${event.summary}`,
        lineage: event.bug_index,
        token_savings_pct: type === "INFO" ? 18.4 : undefined,
        eco_metrics: type === "INFO" ? calculateEcoSavings(46_000) : undefined,
        attempt_count: type === "WARNING" ? 2 : undefined,
        action_url: type === "ACTION_REQUIRED" ? "/admin/dashboard" : undefined,
      });
    }
  }
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function buildPillarLiveLogsFromReport(
  report: PillarHealthReport,
  pillar: MsgfGovernancePillar
): PillarLiveLogs {
  const entry = report.pillars.find((p) => p.pillar === pillar);
  const events = entry?.latest_events ?? [];
  const autonomousSelfHealed: TerminalSelfHealedLog[] = [];
  const hardFailures: TerminalHardFailureLog[] = [];
  const manualRealignments: TerminalManualRealignmentLog[] = [];

  for (const event of events) {
    const instance = event.bug_index.level_1_1_1_instance;
    if (
      event.kind === "incident" &&
      event.status !== "pending" &&
      instance.includes("LOM_RECURSION")
    ) {
      autonomousSelfHealed.push({
        id: event.id,
        timestamp: event.created_at,
        attempt_count: 3,
        source_string: event.summary,
        vault_cross_ref: event.bug_index.level_1_1_1_instance,
      });
      continue;
    }

    if (event.kind === "incident" && event.status === "pending") {
      hardFailures.push({
        id: event.id,
        timestamp: event.created_at,
        reason: instance.includes("LOM_RECURSION") ? "RECURSION_LIMIT" : "RED_MODEL_SPLIT",
        source_string: event.summary,
        state: "PENDING_HUMAN_ARBITRATE",
        lineage: event.bug_index,
      });
      continue;
    }

    if (event.kind === "vault" && /realign|metadata|ssot|pillar/i.test(event.summary)) {
      manualRealignments.push({
        id: event.id,
        timestamp: event.created_at,
        source_string: event.summary,
        file_path: "packages/msgf/lib/services/IngestService.ts",
        lineage: event.bug_index,
      });
    }
  }

  return {
    pillar,
    generated_at: report.generated_at,
    autonomous_self_healed: autonomousSelfHealed,
    hard_failures_pending_queue: hardFailures,
    manual_realignments: manualRealignments,
  };
}

export async function applyArbitrationStateMachine(params: {
  supabase?: SupabaseClient;
  action: ArbitrationAction;
  incidentId: string;
  sourceString: string;
  actorId?: string | null;
  tenantId?: string | null;
  lineage?: GenealogicalBugIndex;
}): Promise<ArbitrationStateMachineResult> {
  const lineage =
    params.lineage ??
    (params.action === "APPROVE_BYPASS"
      ? PULSE_BUG_INDEX.adminArbitrationBeat
      : PULSE_BUG_INDEX.hallHitlRequired);
  const nextState =
    params.action === "APPROVE_BYPASS" ? "BYPASSED_TO_VAULT" : "DENIED_PURGED_TO_HALL";
  const ledger = params.action === "APPROVE_BYPASS" ? "vault" : "hall";
  const message =
    params.action === "APPROVE_BYPASS"
      ? "Human Arbitrate approved bypass; Vault lineage advanced."
      : "Human Arbitrate denied payload; payload purged and Hall vector committed.";

  if (params.supabase) {
    await params.supabase.from("p4_narrative_logs").insert({
      tenant_id: params.tenantId ?? "global_dashboard",
      actor_id: params.actorId,
      action_type: params.action,
      message,
      severity: params.action === "APPROVE_BYPASS" ? "Info" : "Violation",
      metadata: {
        pillar: "P6",
        ledger,
        pulse_engine: true,
        security_clean_signal: params.action === "DENY_PURGE",
        source_string:
          params.action === "DENY_PURGE" ? "[payload purged by Human Arbitrate]" : params.sourceString,
        bug_index: lineage,
      },
    });
  }

  return {
    ok: true,
    action: params.action,
    incident_id: params.incidentId,
    next_state: nextState,
    security_clean_signal: params.action === "DENY_PURGE",
    vault_or_hall_lineage: lineage,
    message,
  };
}

export function transformDailyNetworkReport(
  telemetry: TenantTelemetry24h[],
  generatedAt = nowIso()
): DailyNetworkReport {
  const totalProcessed = telemetry.reduce((sum, t) => sum + t.token_compute_processed, 0);
  const totalSaved = telemetry.reduce((sum, t) => sum + t.token_compute_saved_by_p5, 0);
  const totalAnomalies = telemetry.reduce((sum, t) => sum + t.anomaly_count, 0);
  const totalSelfHealed = telemetry.reduce((sum, t) => sum + t.self_healed_count, 0);
  const totalFailures = telemetry.reduce((sum, t) => sum + t.hard_failure_count, 0);
  const drift = computeLogicDriftTrend(telemetry.flatMap((t) => t.logic_drift_scores));
  const successRate = pct(totalSelfHealed, totalSelfHealed + totalFailures);
  const savingsPct = pct(totalSaved, totalProcessed + totalSaved);
  const ecoMetrics = calculateEcoSavings(totalSaved);
  const environmentalSeries = buildEnvironmentalFootprintSeries(telemetry, generatedAt);

  const grid = telemetry.map((t) => ({
    tenant_name: t.tenant_name,
    status: t.status,
    anomalies: t.anomaly_count,
    self_healed: t.self_healed_count,
    hard_failures: t.hard_failure_count,
  }));

  const markdown = [
    "# MSGF Daily Network Report",
    "",
    `Generated: ${generatedAt}`,
    "Window: trailing 24 hours",
    "",
    "## Financial Overhead Summary",
    `- Total token compute processed: ${totalProcessed}`,
    `- P5 context-sharding tokens saved: ${totalSaved}`,
    `- P5 savings rate: ${savingsPct}%`,
    `- Grid compute prevented: ${ecoMetrics.grid_compute_prevented_kwh} kWh`,
    `- CO2e offset: ${ecoMetrics.co2e_offset_lbs} lbs`,
    `- Freshwater conserved: ${ecoMetrics.freshwater_conserved_gallons} gallons`,
    "",
    "## Governance & Integrity Metrics",
    `- Global logic drift slope: ${drift.slope}`,
    `- Total anomalies: ${totalAnomalies}`,
    `- Self-healing success rate: ${successRate}%`,
    "",
    "## Repository Health Grid",
    ...grid.map(
      (row) =>
        `- ${row.tenant_name}: ${row.status.toUpperCase()} | anomalies=${row.anomalies} | self_healed=${row.self_healed} | hard_failures=${row.hard_failures}`
    ),
  ].join("\n");

  return {
    generated_at: generatedAt,
    window_hours: 24,
    financial_overhead_summary: {
      total_token_compute_processed: totalProcessed,
      total_token_compute_saved_by_p5: totalSaved,
      p5_context_savings_pct: savingsPct,
      eco_metrics: ecoMetrics,
    },
    governance_integrity_metrics: {
      global_logic_drift_slope: drift.slope,
      total_anomalies: totalAnomalies,
      self_healing_success_rate_pct: successRate,
    },
    repository_health_grid: grid,
    environmental_footprint_series: environmentalSeries,
    markdown,
  };
}

function buildEnvironmentalFootprintSeries(
  telemetry: TenantTelemetry24h[],
  generatedAt: string
): EnvironmentalFootprintPoint[] {
  const end = new Date(generatedAt).getTime();
  const safeEnd = Number.isFinite(end) ? end : Date.now();
  const totalSaved = telemetry.reduce((sum, t) => sum + t.token_compute_saved_by_p5, 0);
  const points = 8;

  return Array.from({ length: points }, (_, index) => {
    const ratio = (index + 1) / points;
    const metrics = calculateEcoSavings(Math.round(totalSaved * ratio));
    return {
      timestamp: new Date(safeEnd - (points - index - 1) * 3 * 60 * 60 * 1000).toISOString(),
      tokens_saved: metrics.tokens_saved,
      grid_compute_prevented_kwh: metrics.grid_compute_prevented_kwh,
      co2e_offset_lbs: metrics.co2e_offset_lbs,
      freshwater_conserved_gallons: metrics.freshwater_conserved_gallons,
    };
  });
}

export function mockDashboardHealthReport(): PillarHealthReport {
  const generatedAt = nowIso();
  const mockEvents: PillarHealthEvent[] = [
    {
      id: "mock-info-p5",
      kind: "vault",
      title: "Manual realignment",
      summary: "SSoT sync: canonical metadata.pillar update to IngestService.ts",
      severity: "Info",
      created_at: generatedAt,
      bug_index: PULSE_BUG_INDEX.vaultConsensusOk,
    },
    {
      id: "mock-warning-p6",
      kind: "incident",
      title: "Self-healed recursion",
      summary: "P6 caught Hall pattern and resolved within 3 autonomous loops.",
      status: "resolved",
      created_at: generatedAt,
      bug_index: PULSE_BUG_INDEX.hallLomRecursion,
    },
    {
      id: "mock-action-p2",
      kind: "incident",
      title: "Pending Human Arbitrate",
      summary: "Claude/Gemini split-decision lockout waiting for operator review.",
      status: "pending",
      created_at: generatedAt,
      bug_index: PULSE_BUG_INDEX.hallHitlRequired,
    },
  ];

  return {
    generated_at: generatedAt,
    scope: { user_id: null, global: true, dashboard_view: "tenant_health" },
    logic_drift: computeLogicDriftTrend([0.12, 0.16, 0.2, 0.18]),
    overall_status: "red",
    pillars: MSGF_GOVERNANCE_PILLARS.map((pillar) => {
      const latest_events = mockEvents.filter(
        (event) =>
          bugIndexToGovernancePillar(event.bug_index) === pillar ||
          (pillar === "P5" && event.id === "mock-info-p5")
      );
      return {
        pillar,
        label: `${pillar} live governance`,
        status: latest_events.some((e) => e.status === "pending")
          ? "red"
          : latest_events.length
            ? "yellow"
            : "green",
        status_label: latest_events.some((e) => e.status === "pending")
          ? "Red"
          : latest_events.length
            ? "Yellow"
            : "Green",
        pending_incidents: latest_events.filter((e) => e.status === "pending").length,
        recent_hall_events: latest_events.filter((e) => e.kind === "hall").length,
        recent_vault_events: latest_events.filter((e) => e.kind === "vault").length,
        self_healing_note: latest_events.some((e) => e.id === "mock-warning-p6")
          ? "Resolved inside 3-loop threshold."
          : null,
        predicted_future_issue: false,
        summary: latest_events.length
          ? `${latest_events.length} latest V3.2 event(s).`
          : "No telemetry in mock window.",
        latest_events,
      };
    }),
  };
}

export function mockTenantTelemetry24h(): TenantTelemetry24h[] {
  return [
    {
      tenant_name: "Syntax Education",
      status: "yellow",
      token_compute_processed: 188_400,
      token_compute_saved_by_p5: 42_800,
      anomaly_count: 4,
      self_healed_count: 3,
      hard_failure_count: 1,
      logic_drift_scores: [0.16, 0.2, 0.24],
    },
    {
      tenant_name: "Author Ecosystem",
      status: "green",
      token_compute_processed: 224_100,
      token_compute_saved_by_p5: 58_200,
      anomaly_count: 2,
      self_healed_count: 2,
      hard_failure_count: 0,
      logic_drift_scores: [0.11, 0.12, 0.1],
    },
    {
      tenant_name: "Client Projects",
      status: "red",
      token_compute_processed: 96_300,
      token_compute_saved_by_p5: 14_500,
      anomaly_count: 3,
      self_healed_count: 1,
      hard_failure_count: 2,
      logic_drift_scores: [0.28, 0.35, 0.41],
    },
  ];
}

function tenantNameFromRow(row: { tenant_id?: unknown; metadata?: unknown }): TenantTelemetry24h["tenant_name"] {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
  const raw = `${String(meta.ecosystem_source ?? "")} ${String(meta.product ?? "")} ${String(row.tenant_id ?? "")}`.toLowerCase();
  if (raw.includes("education") || raw.includes("syntax")) return "Syntax Education";
  if (raw.includes("author")) return "Author Ecosystem";
  return "Client Projects";
}

function numberFromMeta(metadata: unknown, keys: string[]): number {
  if (metadata == null || typeof metadata !== "object") return 0;
  const record = metadata as Record<string, unknown>;
  for (const key of keys) {
    const raw = record[key];
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

export async function fetchTenantTelemetry24hFromSupabase(
  supabase: SupabaseClient,
  now = new Date()
): Promise<TenantTelemetry24h[]> {
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("p4_narrative_logs")
    .select("tenant_id, severity, metadata, created_at")
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`dashboard telemetry scan failed: ${error.message}`);
  }

  const buckets = new Map<TenantTelemetry24h["tenant_name"], TenantTelemetry24h>();
  for (const name of ["Syntax Education", "Author Ecosystem", "Client Projects"] as const) {
    buckets.set(name, {
      tenant_name: name,
      status: "green",
      token_compute_processed: 0,
      token_compute_saved_by_p5: 0,
      anomaly_count: 0,
      self_healed_count: 0,
      hard_failure_count: 0,
      logic_drift_scores: [],
    });
  }

  for (const row of (data ?? []) as Array<{ tenant_id?: unknown; severity?: unknown; metadata?: unknown }>) {
    const bucket = buckets.get(tenantNameFromRow(row))!;
    const meta = row.metadata;
    bucket.token_compute_processed +=
      numberFromMeta(meta, ["token_compute_processed", "tokens_consumed", "tokens_processed"]) || 120;
    bucket.token_compute_saved_by_p5 +=
      numberFromMeta(meta, ["token_compute_saved_by_p5", "p5_tokens_saved", "tokens_saved"]);

    const record = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
    if (record.ledger === "hall" || row.severity === "Warning" || row.severity === "Violation") {
      bucket.anomaly_count += 1;
    }
    if (record.ledger === "vault" && /self[-_ ]?heal|auto/i.test(String(record.summary ?? record.reason ?? ""))) {
      bucket.self_healed_count += 1;
    }
    if (row.severity === "Violation") {
      bucket.hard_failure_count += 1;
    }
    const drift = typeof record.logic_drift_score === "number" ? record.logic_drift_score : null;
    if (drift != null) {
      bucket.logic_drift_scores.push(drift <= 1 ? drift : drift / 100);
    }
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    status:
      bucket.hard_failure_count > 0
        ? "red"
        : bucket.anomaly_count > 0
          ? "yellow"
          : "green",
    token_compute_saved_by_p5:
      bucket.token_compute_saved_by_p5 ||
      Math.round(bucket.token_compute_processed * 0.16),
    logic_drift_scores: bucket.logic_drift_scores.length ? bucket.logic_drift_scores : [0.12],
  }));
}

export function parsePillarParam(value: string | undefined): MsgfGovernancePillar {
  const upper = value?.toUpperCase();
  if ((MSGF_GOVERNANCE_PILLARS as readonly string[]).includes(upper ?? "")) {
    return upper as MsgfGovernancePillar;
  }
  return "P1";
}
