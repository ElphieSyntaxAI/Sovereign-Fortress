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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
 */
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
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
 */
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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  statusStyles,
} from "@/app/_components/dashboard/governance-pillar-blocks";
import {
  DAILY_REPORTS_UNSCOPED_ORIGIN,
  type DailyReportDaySnapshot,
  type DailyReportPillarSnapshot,
  type DailyReportsProjectTimeline,
} from "@/lib/services/daily-reports-history";
import type { PillarStoplightStatus } from "@/lib/services/HealthService";

type ApiResponse = {
  ok: boolean;
  projects: DailyReportsProjectTimeline[];
  mapped_project_count?: number;
  error?: string;
};

type MonthGroup = {
  year: number;
  month: number;
  days: DailyReportDaySnapshot[];
};

type YearGroup = {
  year: number;
  months: MonthGroup[];
};

function formatTokensSaved(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M Tokens Saved`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K Tokens Saved`;
  return `${n.toLocaleString()} Tokens Saved`;
}

function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d);
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long" });
}

function governanceBadgeStyles(status: DailyReportDaySnapshot["governance_status"]): string {
  if (status === "red") return "border-rose-500/35 bg-rose-500/15 text-rose-100";
  if (status === "yellow") return "border-amber-500/35 bg-amber-500/15 text-amber-100";
  return "border-emerald-500/35 bg-emerald-500/15 text-emerald-100";
}

function groupDaysByYearMonth(days: DailyReportDaySnapshot[]): YearGroup[] {
  const byYear = new Map<number, Map<number, DailyReportDaySnapshot[]>>();

  for (const day of days) {
    const [y, m] = day.date.split("-").map(Number);
    if (!y || !m) continue;
    if (!byYear.has(y)) byYear.set(y, new Map());
    const months = byYear.get(y)!;
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(day);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, monthsMap]) => ({
      year,
      months: [...monthsMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, monthDays]) => ({
          year,
          month,
          days: monthDays.sort((a, b) => b.date.localeCompare(a.date)),
        })),
    }));
}

function CollapsiblePanel({
  open,
  children,
  id,
}: {
  open: boolean;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div
      id={id}
      className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function PillarMiniGrid({ pillars }: { pillars: DailyReportPillarSnapshot[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {pillars.map((pillar) => {
        const styles = statusStyles(pillar.status as PillarStoplightStatus);
        return (
          <div
            key={pillar.pillar}
            className={`rounded-xl border p-3 text-center ${styles.ring} bg-slate-950/50`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
              {pillar.pillar}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-100">{pillar.label}</p>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} aria-hidden />
              {pillar.status_label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DayRow({
  day,
  open,
  onToggle,
  projectOrigin,
}: {
  day: DailyReportDaySnapshot;
  open: boolean;
  onToggle: () => void;
  projectOrigin: string;
}) {
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(day, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug =
      projectOrigin === DAILY_REPORTS_UNSCOPED_ORIGIN
        ? "unmapped"
        : projectOrigin.replace(/[^\w.-]+/g, "_");
    a.download = `msgf-daily-report-${slug}-${day.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [day, projectOrigin]);

  const exportPdf = useCallback(() => {
    window.print();
  }, []);

  return (
    <article className="rounded-xl border border-slate-800/80 bg-slate-950/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-semibold text-slate-50">{formatDisplayDate(day.date)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${governanceBadgeStyles(day.governance_status)}`}
            >
              {day.governance_summary}
            </span>
            <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100">
              {formatTokensSaved(day.tokens_saved)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 text-xs text-slate-400 sm:text-right">
          <span>
            Stability:{" "}
            <strong className="text-violet-200">{day.stability_forecast_pct.toFixed(1)}%</strong>
          </span>
          <span>
            Logic drift: <strong className="text-amber-200/90">{day.logic_drift_label}</strong>
          </span>
        </div>
      </button>

      <CollapsiblePanel open={open} id={`day-panel-${day.date}`}>
        <div className="space-y-5 border-t border-slate-800/80 px-4 pb-5 pt-4 print:border-slate-300">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-amber-200/80">Incident queue</p>
              <p className="mt-1 text-2xl font-semibold text-amber-50">{day.incident_queue_total}</p>
            </div>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-rose-200/80">Hall events</p>
              <p className="mt-1 text-2xl font-semibold text-rose-50">{day.hall_events_total}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
              Six-pillar snapshot
            </p>
            <PillarMiniGrid pillars={day.pillars} />
          </div>

          {day.markdown ? (
            <pre className="max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400 print:max-h-none">
              {day.markdown}
            </pre>
          ) : null}

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20"
            >
              Export PDF report
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20"
            >
              Export JSON report
            </button>
            <Link
              href={`/dashboard?report_date=${day.date}#security-view`}
              className="rounded-full border border-slate-600/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
            >
              View detailed logs
            </Link>
          </div>
        </div>
      </CollapsiblePanel>
    </article>
  );
}

function DailyReportsTimeline({
  days,
  projectOrigin,
}: {
  days: DailyReportDaySnapshot[];
  projectOrigin: string;
}) {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set([currentYear]));
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([`${currentYear}-${currentMonth}`])
  );
  const [expandedDay, setExpandedDay] = useState<string | null>(() => days[0]?.date ?? null);

  useEffect(() => {
    if (days[0]) setExpandedDay(days[0].date);
  }, [projectOrigin, days]);

  const yearGroups = useMemo(() => groupDaysByYearMonth(days), [days]);

  if (!yearGroups.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center text-sm text-slate-500">
        No daily reports for this repository yet. IDE and governance events tagged with this
        project will appear here — separate from your other mapped repos.
      </p>
    );
  }

  return (
    <div className="space-y-4" aria-label="Daily reports by year and month">
      {yearGroups.map((yearGroup) => {
        const yearOpen = expandedYears.has(yearGroup.year);
        return (
          <section
            key={yearGroup.year}
            className="glass-panel overflow-hidden rounded-2xl border border-violet-500/20"
          >
            <button
              type="button"
              onClick={() => {
                setExpandedYears((prev) => {
                  const next = new Set(prev);
                  if (next.has(yearGroup.year)) next.delete(yearGroup.year);
                  else next.add(yearGroup.year);
                  return next;
                });
              }}
              aria-expanded={yearOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.02] sm:px-5"
            >
              <span className="text-lg font-bold text-slate-50">{yearGroup.year}</span>
              <span className="text-xs text-slate-500">
                {yearGroup.months.length} month{yearGroup.months.length === 1 ? "" : "s"}
              </span>
            </button>

            <CollapsiblePanel open={yearOpen} id={`year-${projectOrigin}-${yearGroup.year}`}>
              <div className="space-y-3 border-t border-slate-800/80 px-3 pb-4 pt-2 sm:px-4">
                {yearGroup.months.map((monthGroup) => {
                  const monthKey = `${yearGroup.year}-${monthGroup.month}`;
                  const monthOpen = expandedMonths.has(monthKey);
                  return (
                    <section
                      key={monthKey}
                      className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedMonths((prev) => {
                            const next = new Set(prev);
                            if (next.has(monthKey)) next.delete(monthKey);
                            else next.add(monthKey);
                            return next;
                          });
                        }}
                        aria-expanded={monthOpen}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
                      >
                        <span className="font-semibold text-slate-100">
                          {monthLabel(yearGroup.year, monthGroup.month)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {monthGroup.days.length} day{monthGroup.days.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      <CollapsiblePanel open={monthOpen} id={`month-${projectOrigin}-${monthKey}`}>
                        <div className="space-y-2 border-t border-slate-800/60 px-3 pb-3 pt-2">
                          {monthGroup.days.map((day) => (
                            <DayRow
                              key={day.date}
                              day={day}
                              projectOrigin={projectOrigin}
                              open={expandedDay === day.date}
                              onToggle={() =>
                                setExpandedDay((prev) => (prev === day.date ? null : day.date))
                              }
                            />
                          ))}
                        </div>
                      </CollapsiblePanel>
                    </section>
                  );
                })}
              </div>
            </CollapsiblePanel>
          </section>
        );
      })}
    </div>
  );
}

export function DailyReportsAccordion() {
  const [projects, setProjects] = useState<DailyReportsProjectTimeline[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/dashboard/daily-reports?lookback_days=120", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const timelines = json.projects ?? [];
      setProjects(timelines);
      setSelectedOrigin((prev) => {
        if (prev && timelines.some((t) => t.project_origin === prev)) return prev;
        return timelines[0]?.project_origin ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load daily reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTimeline = useMemo(
    () => projects.find((p) => p.project_origin === selectedOrigin) ?? null,
    [projects, selectedOrigin]
  );

  const showRepoPicker = projects.length > 1;

  if (loading) {
    return (
      <p className="rounded-2xl border border-slate-800 bg-slate-950/50 px-6 py-12 text-center text-sm text-slate-500">
        Loading daily reports…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center text-sm text-amber-100">
        {error}
      </p>
    );
  }

  if (!projects.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 text-center text-sm text-slate-500">
        Map at least one repository under Project Governance on the dashboard. Daily reports are
        kept separate per repo — DealStar and other workspaces never share a blended timeline.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-slate-300">
        Each mapped repository has its own archive. Events are filtered by{" "}
        <code className="text-violet-200">project_origin</code> in narrative metadata — not merged
        across repos. Network-wide digests are not overlaid on your personal timeline.
      </p>

      {showRepoPicker ? (
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Select repository for daily reports"
        >
          {projects.map((timeline) => {
            const active = timeline.project_origin === selectedOrigin;
            const isUnscoped = timeline.project_origin === DAILY_REPORTS_UNSCOPED_ORIGIN;
            return (
              <button
                key={timeline.project_origin}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedOrigin(timeline.project_origin)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-50"
                    : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-600"
                }`}
              >
                {timeline.display_name}
                {isUnscoped ? (
                  <span className="ml-1.5 text-xs text-slate-500">(no repo tag)</span>
                ) : null}
                <span className="ml-2 text-xs text-slate-500">{timeline.days.length}d</span>
              </button>
            );
          })}
        </div>
      ) : selectedTimeline ? (
        <p className="text-sm text-slate-400">
          Repository: <span className="font-medium text-slate-200">{selectedTimeline.display_name}</span>
          <span className="ml-2 font-mono text-xs text-slate-500">{selectedTimeline.project_origin}</span>
        </p>
      ) : null}

      {selectedTimeline ? (
        <DailyReportsTimeline
          key={selectedTimeline.project_origin}
          days={selectedTimeline.days}
          projectOrigin={selectedTimeline.project_origin}
        />
      ) : null}
    </div>
  );
}
