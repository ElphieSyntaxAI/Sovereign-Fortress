"use client";
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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { UserBlueprintEcoPanel } from "@/app/_components/dashboard/UserBlueprintEcoPanel";
import { GOVERNANCE_PILLAR_CARDS } from "@/lib/dashboard-pillar-copy";
import type {
  MasterEcoLeaderboard,
} from "@/lib/services/EcoAggregatorClient";
import type {
  DailyNetworkReport,
  GlobalNotificationTickerEvent,
  PillarLiveLogs,
  TerminalHardFailureLog,
  ArbitrationStateMachineResult,
  ArbitrationAction,
  EnvironmentalFootprintPoint,
} from "@/lib/services/dashboard-orchestration";
import type { EcoMetrics } from "@/lib/utils/ecoCalculator";
import type {
  PillarHealthEntry,
  PillarHealthEvent,
  PillarHealthReport,
  PillarStoplightStatus,
} from "@/lib/services/HealthService";
import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";
import {
  healthPillarsQuery,
  type DashboardHealthScopeMode,
} from "@/lib/dashboard-health-scope";

type Props = {
  userEmail: string;
  initialReport: PillarHealthReport;
  authRedirectPath?: string;
  dashboardLabel?: string;
  /** `personal` = signed-in user only; `operator` = admin/company rollup. */
  healthScope?: DashboardHealthScopeMode;
  canAccessAdminDashboard?: boolean;
  scopeDescription?: string;
  showMasterEcoLeaderboard?: boolean;
  /** Network ticker + daily digest (operator / platform view). */
  showNetworkStreams?: boolean;
  /** When true, omit duplicate nav/chrome (parent uses AdminPortalNav). */
  embeddedInAdminPortal?: boolean;
  /** Elphie Syntax product family cards (pass from a server page, e.g. ProductExplorerSection). */
  productExplorer?: ReactNode;
};

type PillarHealthApiResponse = PillarHealthReport & { ok?: boolean; error?: string };

type TickerApiResponse = {
  ok: boolean;
  events: GlobalNotificationTickerEvent[];
  error?: string;
};

type PillarLogsApiResponse = {
  ok: boolean;
  logs: PillarLiveLogs;
  error?: string;
};

type DailyReportApiResponse = {
  ok: boolean;
  report: DailyNetworkReport;
  error?: string;
};

type MasterEcoLeaderboardApiResponse = {
  ok: boolean;
  leaderboard: MasterEcoLeaderboard;
  error?: string;
};

type ArbitrationApiResponse =
  | (ArbitrationStateMachineResult & { source?: "live" | "mock" })
  | { ok: false; error: string };

const REFRESH_MS = 30_000;

function statusStyles(status: PillarStoplightStatus): {
  dot: string;
  ring: string;
  badge: string;
} {
  switch (status) {
    case "green":
      return {
        dot: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]",
        ring: "border-emerald-500/30",
        badge: "bg-emerald-500/15 text-emerald-200",
      };
    case "yellow":
    case "yellow_self_healing":
      return {
        dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]",
        ring: "border-amber-500/30",
        badge: "bg-amber-500/15 text-amber-200",
      };
    case "red":
      return {
        dot: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.55)]",
        ring: "border-rose-500/35",
        badge: "bg-rose-500/15 text-rose-200",
      };
    case "predicted":
      return {
        dot: "bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.5)] animate-pulse",
        ring: "border-violet-500/35",
        badge: "bg-violet-500/15 text-violet-200",
      };
    default:
      return {
        dot: "bg-slate-500",
        ring: "border-slate-600/40",
        badge: "bg-slate-500/15 text-slate-300",
      };
  }
}

function overallLabel(status: PillarStoplightStatus): string {
  switch (status) {
    case "green":
      return "All pillars nominal";
    case "yellow_self_healing":
      return "Elevated — self-healing active";
    case "yellow":
      return "Elevated watch";
    case "red":
      return "Intervention required";
    case "predicted":
      return "Predictive drift alert";
    default:
      return "Unknown";
  }
}

function MetricCard({
  label,
  value,
  hint,
  accent = "emerald",
}: {
  label: string;
  value: string | number;
  hint: string;
  accent?: "emerald" | "violet" | "amber" | "rose";
}) {
  const accentBorder =
    accent === "violet"
      ? "border-violet-500/25"
      : accent === "amber"
        ? "border-amber-500/25"
        : accent === "rose"
          ? "border-rose-500/25"
          : "border-emerald-500/25";

  return (
    <div className={`glass-panel rounded-2xl border p-5 ${accentBorder}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function tickerStyles(type: GlobalNotificationTickerEvent["type"]): string {
  if (type === "ACTION_REQUIRED") return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  if (type === "WARNING") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
}

function GlobalNotificationTicker({ events }: { events: GlobalNotificationTickerEvent[] }) {
  return (
    <section className="glass-panel rounded-2xl border border-violet-500/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
          Global notification ticker
        </p>
        <span className="text-xs text-slate-500">V3.2 real-time stream</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {events.length ? (
          events.map((event) => (
            <article
              key={event.id}
              className={`min-w-[18rem] rounded-xl border px-3 py-3 ${tickerStyles(event.type)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wider">{event.type}</span>
                <span className="text-[11px] opacity-75">{event.pillar}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm">{event.message}</p>
              <p className="mt-2 text-[11px] opacity-70">
                {new Date(event.timestamp).toLocaleTimeString()} · {event.source}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-500">No ticker events in the current stream.</p>
        )}
      </div>
    </section>
  );
}

function PillarCard({
  pillarId,
  title,
  subtitle,
  v32Step,
  status,
  statusLabel,
  pending,
  hall,
  vault,
  summary,
  selected,
  onSelect,
}: {
  pillarId: string;
  title: string;
  subtitle: string;
  v32Step: string;
  status: PillarStoplightStatus;
  statusLabel: string;
  pending: number;
  hall: number;
  vault: number;
  summary: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const styles = statusStyles(status);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`glass-panel glass-panel-emerald flex h-full flex-col gap-4 rounded-2xl border p-5 text-left transition hover:border-violet-400/40 hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-violet-400/40 ${styles.ring} ${
        selected ? "border-violet-400/60 bg-violet-500/10" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300/80">{pillarId}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${styles.badge}`}
        >
          <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden />
          {statusLabel}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-slate-300">{summary}</p>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-900/50 px-2 py-2">
          <dt className="text-slate-500">Queue</dt>
          <dd className="mt-0.5 font-semibold text-slate-100">{pending}</dd>
        </div>
        <div className="rounded-lg bg-slate-900/50 px-2 py-2">
          <dt className="text-slate-500">Hall</dt>
          <dd className="mt-0.5 font-semibold text-rose-200/90">{hall}</dd>
        </div>
        <div className="rounded-lg bg-slate-900/50 px-2 py-2">
          <dt className="text-slate-500">Vault</dt>
          <dd className="mt-0.5 font-semibold text-emerald-200/90">{vault}</dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-violet-400/70">
          V3.2 · {v32Step}
        </p>
        <span className="text-xs font-medium text-emerald-200">
          View latest →
        </span>
      </div>
    </button>
  );
}

function eventKindStyles(kind: PillarHealthEvent["kind"]): string {
  switch (kind) {
    case "incident":
      return "border-amber-500/25 bg-amber-500/10 text-amber-100";
    case "hall":
      return "border-rose-500/25 bg-rose-500/10 text-rose-100";
    case "vault":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-violet-500/25 bg-violet-500/10 text-violet-100";
  }
}

function PillarDrilldown({ pillar }: { pillar: PillarHealthEntry }) {
  return (
    <section className="glass-panel rounded-2xl border border-violet-500/20 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            {pillar.pillar} latest activity
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-50">{pillar.label}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Latest MSGF issues, Vault changes, Hall bugs, and incident activity in the current dashboard scope.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
          {pillar.latest_events.length} recent item{pillar.latest_events.length === 1 ? "" : "s"}
        </span>
      </div>

      {pillar.latest_events.length > 0 ? (
        <div className="mt-5 space-y-3">
          {pillar.latest_events.map((event) => (
            <article
              key={`${event.kind}-${event.id}`}
              className="rounded-xl border border-slate-800/80 bg-slate-950/55 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${eventKindStyles(event.kind)}`}>
                  {event.kind}
                </span>
                <time className="text-xs text-slate-500" dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">{event.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{event.summary}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-violet-300/70">
                {event.bug_index.level_1_category} → {event.bug_index.level_1_1_branch} →{" "}
                {event.bug_index.level_1_1_1_instance}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100/90">
          No recent issues, changes, or bugs were recorded for this pillar in the current lookback window.
        </div>
      )}
    </section>
  );
}

function HardFailureActions({
  failure,
  pillar,
  onAction,
}: {
  failure: TerminalHardFailureLog;
  pillar: MsgfGovernancePillar;
  onAction: (failure: TerminalHardFailureLog, action: ArbitrationAction) => Promise<void>;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void onAction(failure, "APPROVE_BYPASS")}
        className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
      >
        APPROVE & BYPASS {pillar}
      </button>
      <button
        type="button"
        onClick={() => void onAction(failure, "DENY_PURGE")}
        className="rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
      >
        DENY & PURGE
      </button>
    </div>
  );
}

function TerminalArray({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 font-mono">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-300">{title}</p>
      {children}
    </section>
  );
}

function PillarTerminalDrawer({
  logs,
  actionResult,
  onAction,
}: {
  logs: PillarLiveLogs | null;
  actionResult: ArbitrationStateMachineResult | null;
  onAction: (failure: TerminalHardFailureLog, action: ArbitrationAction) => Promise<void>;
}) {
  if (!logs) return null;
  return (
    <section className="glass-panel rounded-2xl border border-emerald-500/15 p-5">
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
          In-pillar live logs & arbitration drawer
        </p>
        <h2 className="text-xl font-semibold text-slate-50">{logs.pillar} terminal arrays</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <TerminalArray title="Autonomous Self-Healed">
          {logs.autonomous_self_healed.length ? (
            logs.autonomous_self_healed.map((item) => (
              <p key={item.id} className="mb-2 text-xs text-slate-300">
                [{item.attempt_count}/3] {new Date(item.timestamp).toLocaleString()} · {item.source_string}
              </p>
            ))
          ) : (
            <p className="text-xs text-slate-500">No autonomous recovery entries.</p>
          )}
        </TerminalArray>
        <TerminalArray title="Hard Failures Pending Queue">
          {logs.hard_failures_pending_queue.length ? (
            logs.hard_failures_pending_queue.map((item) => (
              <div key={item.id} className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <p className="text-xs text-rose-100">{item.reason} · {item.state}</p>
                <p className="mt-1 text-xs text-slate-400">{item.source_string}</p>
                <HardFailureActions failure={item} pillar={logs.pillar} onAction={onAction} />
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">No hard failures waiting for Human Arbitrate.</p>
          )}
        </TerminalArray>
        <TerminalArray title="Manual Realignments">
          {logs.manual_realignments.length ? (
            logs.manual_realignments.map((item) => (
              <p key={item.id} className="mb-2 text-xs text-slate-300">
                {new Date(item.timestamp).toLocaleString()} · {item.file_path} · {item.source_string}
              </p>
            ))
          ) : (
            <p className="text-xs text-slate-500">No SSoT realignment entries.</p>
          )}
        </TerminalArray>
      </div>
      {actionResult ? (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {actionResult.message} State: {actionResult.next_state}
        </div>
      ) : null}
    </section>
  );
}

function DailyNetworkReportPanel({ report }: { report: DailyNetworkReport | null }) {
  if (!report) return null;
  return (
    <section className="glass-panel rounded-2xl border border-violet-500/20 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Daily network report aggregator
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">24h MSGF network summary</h2>
        </div>
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100">
          P5 saved {report.financial_overhead_summary.p5_context_savings_pct}%
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Tokens processed"
          value={report.financial_overhead_summary.total_token_compute_processed}
          hint={`${report.financial_overhead_summary.total_token_compute_saved_by_p5} saved by P5`}
        />
        <MetricCard
          label="Anomalies"
          value={report.governance_integrity_metrics.total_anomalies}
          hint={`Drift slope ${report.governance_integrity_metrics.global_logic_drift_slope}`}
          accent="amber"
        />
        <MetricCard
          label="Self-heal rate"
          value={`${report.governance_integrity_metrics.self_healing_success_rate_pct}%`}
          hint="Resolved before Human Arbitrate"
          accent="emerald"
        />
      </div>
      <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
        {report.markdown}
      </pre>
    </section>
  );
}

function formatEcoMetric(value: number, unit: string): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${unit}`;
}

function EnvironmentalFootprintAreaGraph({
  points,
}: {
  points: EnvironmentalFootprintPoint[];
}) {
  const width = 560;
  const height = 150;
  const padding = 12;
  const maxValue = Math.max(...points.map((point) => point.co2e_offset_lbs), 0.0001);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const coordinates = points.map((point, index) => {
    const x = padding + (points.length === 1 ? 0 : (index / (points.length - 1)) * usableWidth);
    const y = height - padding - (point.co2e_offset_lbs / maxValue) * usableHeight;
    return { x, y };
  });
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${height - padding} L ${coordinates[0].x.toFixed(2)} ${height - padding} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Environmental footprint reduction over time"
      className="h-40 w-full"
    >
      <defs>
        <linearGradient id="ecoArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#ecoArea)" />
      <path d={linePath} fill="none" stroke="rgb(52 211 153)" strokeLinecap="round" strokeWidth="3" />
      {coordinates.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={point.x}
          cy={point.y}
          r="3.5"
          fill="rgb(167 243 208)"
        />
      ))}
    </svg>
  );
}

function EnvironmentalMitigationSummaryCard({
  metrics,
  savingsPct,
  points,
}: {
  metrics: EcoMetrics;
  savingsPct: number;
  points: EnvironmentalFootprintPoint[];
}) {
  return (
    <section className="glass-panel rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.03] p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Sustainable compute layer
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">
            Environmental Mitigation Summary
          </h2>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-100">
          CSR / ESG tracked
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/70 p-4 font-mono">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400/80">Freshwater Conserved</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">
            {formatEcoMetric(metrics.freshwater_conserved_gallons, "gal")}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/70 p-4 font-mono">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400/80">CO2e Offset</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">
            {formatEcoMetric(metrics.co2e_offset_lbs, "lbs")}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-slate-950/70 p-4 font-mono">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400/80">Grid Compute Prevented</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">
            {formatEcoMetric(metrics.grid_compute_prevented_kwh, "kWh")}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <EnvironmentalFootprintAreaGraph points={points} />
      </div>

      <p className="mt-4 font-mono text-xs text-emerald-100/80">
        Pillar 5 Context Sharding isolated locally. Redundant token overhead dropped by{" "}
        {savingsPct}%.
      </p>
    </section>
  );
}

function MasterEcoLeaderboardWidget({ leaderboard }: { leaderboard: MasterEcoLeaderboard | null }) {
  if (!leaderboard) return null;

  return (
    <section className="glass-panel rounded-2xl border border-emerald-500/25 bg-slate-950/55 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Master Admin Portal · Network CSR Ledger
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">
            Corporate Ecosystem Green Offset Leaderboard
          </h2>
        </div>
        <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 font-mono text-xs text-violet-100">
          {leaderboard.source}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-black/35 p-4 font-mono">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400/80">
            Total Corporate Ecosystem Energy Avoided
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">
            {leaderboard.totals.energy_avoided_mwh.toLocaleString(undefined, { maximumFractionDigits: 6 })} MWh
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-black/35 p-4 font-mono">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400/80">
            Gross Metric Tons of CO2e Prevented
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">
            {leaderboard.totals.co2e_prevented_metric_tons.toLocaleString(undefined, { maximumFractionDigits: 6 })} t
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-black/35 p-4 font-mono">
          <p className="text-[11px] uppercase tracking-wider text-emerald-400/80">
            Net Megagallons Freshwater Saved
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">
            {leaderboard.totals.freshwater_saved_mgal.toLocaleString(undefined, { maximumFractionDigits: 6 })} MGAL
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 font-mono text-xs">
          <thead className="bg-slate-950/80 text-emerald-300/90">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Tenant</th>
              <th className="px-4 py-3 text-right font-semibold">Contribution</th>
              <th className="px-4 py-3 text-right font-semibold">Tokens Saved</th>
              <th className="px-4 py-3 text-right font-semibold">CO2e lbs</th>
              <th className="px-4 py-3 text-right font-semibold">Last Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {leaderboard.tenants.map((tenant) => (
              <tr key={tenant.tenant_id}>
                <td className="px-4 py-3 text-slate-100">{tenant.tenant_id}</td>
                <td className="px-4 py-3 text-right text-emerald-200">
                  {tenant.contribution_pct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
                </td>
                <td className="px-4 py-3 text-right">{tenant.total_tokens_saved.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {tenant.total_co2e_offset_lbs.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">
                  {new Date(tenant.last_observed_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DashboardShell({
  userEmail,
  initialReport,
  authRedirectPath = "/sign-in?next=/dashboard",
  dashboardLabel = "Governance dashboard",
  healthScope = "personal",
  canAccessAdminDashboard = false,
  scopeDescription = "your mapped repositories and MSGF activity",
  showMasterEcoLeaderboard = false,
  showNetworkStreams = false,
  embeddedInAdminPortal = false,
  productExplorer = null,
}: Props) {
  const [report, setReport] = useState<PillarHealthReport>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>(initialReport.generated_at);
  const [selectedPillarId, setSelectedPillarId] = useState<MsgfGovernancePillar>(
    initialReport.pillars[0]?.pillar ?? "P1"
  );
  const [tickerEvents, setTickerEvents] = useState<GlobalNotificationTickerEvent[]>([]);
  const [pillarLogs, setPillarLogs] = useState<PillarLiveLogs | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyNetworkReport | null>(null);
  const [masterLeaderboard, setMasterLeaderboard] = useState<MasterEcoLeaderboard | null>(null);
  const [actionResult, setActionResult] = useState<ArbitrationStateMachineResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(healthPillarsQuery(healthScope, 168), {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.assign(authRedirectPath);
        return;
      }
      const json = (await res.json()) as PillarHealthApiResponse;
      if (!res.ok || json.ok === false) {
        throw new Error(json.error ?? `Health API returned ${res.status}`);
      }
      const { ok: _ok, error: _err, ...nextReport } = json;
      setReport(nextReport as PillarHealthReport);
      setLastRefresh(nextReport.generated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh pillar health.");
    } finally {
      setLoading(false);
    }
  }, [authRedirectPath, healthScope]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const refreshDashboardStreams = useCallback(async () => {
    if (!showNetworkStreams) return;

    const requests: Promise<void>[] = [
      fetch("/api/msgf/dashboard/ticker", { credentials: "include", cache: "no-store" }).then(
        async (tickerRes) => {
          const tickerJson = (await tickerRes.json()) as TickerApiResponse;
          if (tickerRes.ok && tickerJson.ok) {
            setTickerEvents(tickerJson.events);
          }
        }
      ),
      fetch("/api/msgf/dashboard/daily-report", { credentials: "include", cache: "no-store" }).then(
        async (reportRes) => {
          const reportJson = (await reportRes.json()) as DailyReportApiResponse;
          if (reportRes.ok && reportJson.ok) {
            setDailyReport(reportJson.report);
          }
        }
      ),
    ];

    if (showMasterEcoLeaderboard) {
      requests.push(
        fetch("/api/msgf/master/eco-rollups", { credentials: "include", cache: "no-store" }).then(
          async (leaderboardRes) => {
            const leaderboardJson = (await leaderboardRes.json()) as MasterEcoLeaderboardApiResponse;
            if (leaderboardRes.ok && leaderboardJson.ok) {
              setMasterLeaderboard(leaderboardJson.leaderboard);
            }
          }
        )
      );
    }

    await Promise.all(requests);
  }, [showMasterEcoLeaderboard]);

  const refreshPillarLogs = useCallback(async (pillar: MsgfGovernancePillar) => {
    const res = await fetch(`/api/msgf/dashboard/pillar/${pillar}`, {
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json()) as PillarLogsApiResponse;
    if (res.ok && json.ok) {
      setPillarLogs(json.logs);
    }
  }, []);

  useEffect(() => {
    if (!showNetworkStreams && !showMasterEcoLeaderboard) return;
    void refreshDashboardStreams();
    const id = window.setInterval(() => void refreshDashboardStreams(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refreshDashboardStreams, showNetworkStreams, showMasterEcoLeaderboard]);

  useEffect(() => {
    setActionResult(null);
    void refreshPillarLogs(selectedPillarId);
  }, [refreshPillarLogs, selectedPillarId]);

  const applyArbitrationAction = useCallback(
    async (failure: TerminalHardFailureLog, action: ArbitrationAction) => {
      const res = await fetch(`/api/msgf/dashboard/pillar/${selectedPillarId}/arbitrate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: failure.id,
          action,
          source_string: failure.source_string,
        }),
      });
      const json = (await res.json()) as ArbitrationApiResponse;
      if (!res.ok || !json.ok) {
        setError("error" in json ? json.error : "Failed to apply arbitration action.");
        return;
      }
      setActionResult(json);
      await refreshPillarLogs(selectedPillarId);
      await refreshDashboardStreams();
    },
    [refreshDashboardStreams, refreshPillarLogs, selectedPillarId]
  );

  const pendingTotal = useMemo(
    () => report.pillars.reduce((sum, p) => sum + p.pending_incidents, 0),
    [report.pillars]
  );

  const hallTotal = useMemo(
    () => report.pillars.reduce((sum, p) => sum + p.recent_hall_events, 0),
    [report.pillars]
  );

  const pillarById = useMemo(() => {
    const map = new Map(report.pillars.map((p) => [p.pillar, p]));
    return map;
  }, [report.pillars]);

  const selectedPillar = useMemo(
    () => pillarById.get(selectedPillarId) ?? report.pillars[0] ?? null,
    [pillarById, report.pillars, selectedPillarId]
  );

  const overallStyles = statusStyles(report.overall_status);

  const content = (
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
              Glass-box overview
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="text-gradient-jewel">{dashboardLabel}</span>
            </h1>
            <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
              Real-time stoplight matrix for MSGF V3.0 six-pillar governance and V3.2-ULTRA execution
              (SHARD → PERSIST). Data refreshes every 30 seconds from {scopeDescription}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${overallStyles.badge} ${overallStyles.ring}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${overallStyles.dot}`} aria-hidden />
              {overallLabel(report.overall_status)}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}

        {showNetworkStreams ? <GlobalNotificationTicker events={tickerEvents} /> : null}

        {healthScope === "personal" ? (
          <section className="glass-panel rounded-2xl border border-cyan-500/15 p-4">
            <p className="text-sm text-slate-300">
              Showing <strong className="text-cyan-100">your</strong> pillar health
              {report.scope.project_origins?.length
                ? ` for ${report.scope.project_origins.length} mapped project(s).`
                : " for your account."}{" "}
              <Link href="/workspace#ide-setup" className="text-cyan-300 hover:underline">
                IDE setup
              </Link>{" "}
              ·{" "}
              <Link href="/setup/projects" className="text-cyan-300 hover:underline">
                Map projects
              </Link>
            </p>
          </section>
        ) : null}

        {canAccessAdminDashboard ? (
        <section className="glass-panel rounded-2xl border border-emerald-500/15 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80">
                Dashboard switcher
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Governance is the pillar health lens; Admin is the operator lens for global/company incident work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/portal"
                className="rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
              >
                Admin portal
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20"
              >
                Your governance
              </Link>
              <Link
                href="/admin/dashboard"
                className="rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
              >
                Ops dashboard
              </Link>
            </div>
          </div>
        </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Platform metrics">
          <MetricCard
            label="Incident queue"
            value={pendingTotal}
            hint="Pending ARBITRATE items across pillars"
            accent={pendingTotal > 0 ? "amber" : "emerald"}
          />
          <MetricCard
            label="Hall events (7d)"
            value={hallTotal}
            hint="Recent failure / constraint signals"
            accent={hallTotal > 5 ? "rose" : "violet"}
          />
          <MetricCard
            label="Logic drift"
            value={report.logic_drift.trend}
            hint={`Slope ${report.logic_drift.slope.toFixed(3)} · ${report.logic_drift.sample_count} samples`}
            accent="violet"
          />
          <MetricCard
            label="Stability forecast"
            value={`${report.logic_drift.predicted_stability_pct}%`}
            hint={`Next ${report.logic_drift.predictive_pulse_horizon} pulses`}
            accent={report.logic_drift.predicted_future_issue ? "amber" : "emerald"}
          />
        </section>

        <section className="glass-panel rounded-2xl border border-violet-500/15 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Last updated {new Date(lastRefresh).toLocaleString()}</span>
            <span>Lookback 168h · Auto-refresh 30s</span>
          </div>
        </section>

        {productExplorer}

        {!showMasterEcoLeaderboard ? <UserBlueprintEcoPanel /> : null}

        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Six governance pillars"
        >
          {GOVERNANCE_PILLAR_CARDS.map((copy) => {
            const live = pillarById.get(copy.pillar);
            return (
              <PillarCard
                key={copy.pillar}
                pillarId={copy.pillar}
                title={copy.title}
                subtitle={copy.subtitle}
                v32Step={copy.v32Step}
                status={live?.status ?? "green"}
                statusLabel={live?.status_label ?? "Green"}
                pending={live?.pending_incidents ?? 0}
                hall={live?.recent_hall_events ?? 0}
                vault={live?.recent_vault_events ?? 0}
                summary={live?.summary ?? "No telemetry in lookback window."}
                selected={selectedPillarId === copy.pillar}
                onSelect={() => setSelectedPillarId(copy.pillar)}
              />
            );
          })}
        </section>

        {selectedPillar ? <PillarDrilldown pillar={selectedPillar} /> : null}

        <PillarTerminalDrawer
          logs={pillarLogs}
          actionResult={actionResult}
          onAction={applyArbitrationAction}
        />

        <DailyNetworkReportPanel report={dailyReport} />

        {dailyReport ? (
          <EnvironmentalMitigationSummaryCard
            metrics={dailyReport.financial_overhead_summary.eco_metrics}
            savingsPct={dailyReport.financial_overhead_summary.p5_context_savings_pct}
            points={dailyReport.environmental_footprint_series}
          />
        ) : null}

        {showMasterEcoLeaderboard ? (
          <MasterEcoLeaderboardWidget leaderboard={masterLeaderboard} />
        ) : null}

        <p className="text-center text-xs text-slate-600">
          MSGF V3.2-ULTRA · Cold layer authoritative · Redis hot path when configured
        </p>
      </main>
  );

  if (embeddedInAdminPortal) {
    return content;
  }

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <DashboardNav
        userEmail={userEmail}
        showAdminPortalLink={canAccessAdminDashboard}
      />
      {content}
    </div>
  );
}
