"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { GOVERNANCE_PILLAR_CARDS } from "@/lib/dashboard-pillar-copy";
import type {
  PillarHealthReport,
  PillarStoplightStatus,
} from "@/lib/services/HealthService";

type Props = {
  userEmail: string;
  initialReport: PillarHealthReport;
};

type PillarHealthApiResponse = PillarHealthReport & { ok?: boolean; error?: string };

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
}) {
  const styles = statusStyles(status);

  return (
    <article
      className={`glass-panel glass-panel-emerald flex flex-col gap-4 rounded-2xl border p-5 transition hover:border-violet-400/25 ${styles.ring}`}
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

      <p className="text-[11px] font-medium uppercase tracking-wider text-violet-400/70">
        V3.2 · {v32Step}
      </p>
    </article>
  );
}

export function DashboardShell({ userEmail, initialReport }: Props) {
  const [report, setReport] = useState<PillarHealthReport>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>(initialReport.generated_at);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/health/pillars?lookback_hours=168", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.assign("/sign-in?next=/dashboard");
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
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

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

  const overallStyles = statusStyles(report.overall_status);

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <DashboardNav userEmail={userEmail} />

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
              Glass-box overview
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="text-gradient-jewel">Governance dashboard</span>
            </h1>
            <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
              Real-time stoplight matrix for MSGF V3.0 six-pillar governance and V3.2-ULTRA execution
              (SHARD → PERSIST). Data refreshes every 30 seconds from your tenant telemetry.
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
              />
            );
          })}
        </section>

        <p className="text-center text-xs text-slate-600">
          MSGF V3.2-ULTRA · Cold layer authoritative · Redis hot path when configured
        </p>
      </main>
    </div>
  );
}
