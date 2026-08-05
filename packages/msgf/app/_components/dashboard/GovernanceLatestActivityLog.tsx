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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221141Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T220451Z-internal
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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
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
import { useCallback, useEffect, useMemo, useState } from "react";

import type { GlobalNotificationTickerEvent } from "@/lib/services/dashboard-orchestration";
import type { PillarHealthReport } from "@/lib/services/HealthService";

type MappedProject = { project_origin: string; label: string };

type TickerApiResponse = {
  ok: boolean;
  events: GlobalNotificationTickerEvent[];
};

type ActivityRow = {
  id: string;
  projectLabel: string;
  message: string;
  urgent: boolean;
  timestamp: string;
  pillar: string;
  kind: "ticker" | "pillar";
};

const REFRESH_MS = 30_000;

function tickerUrgent(type: GlobalNotificationTickerEvent["type"]): boolean {
  return type === "ACTION_REQUIRED" || type === "WARNING";
}

function rowStyles(urgent: boolean): string {
  if (urgent) return "border-rose-500/35 bg-rose-500/10";
  return "border-slate-800/80 bg-slate-950/55";
}

function buildPillarActivities(
  report: PillarHealthReport,
  projects: MappedProject[]
): ActivityRow[] {
  const fallbackLabel = projects[0]?.label ?? "Your workspace";
  const rows: ActivityRow[] = [];

  for (const pillar of report.pillars) {
    for (const event of pillar.latest_events.slice(0, 3)) {
      const urgent = event.kind === "incident" || event.kind === "hall";
      rows.push({
        id: `pillar-${pillar.pillar}-${event.id}`,
        projectLabel: fallbackLabel,
        message: `${pillar.label}: ${event.title} — ${event.summary}`,
        urgent,
        timestamp: event.created_at,
        pillar: pillar.pillar,
        kind: "pillar",
      });
    }
  }

  return rows;
}

export function GovernanceLatestActivityLog({
  report,
  mappedProjects,
}: {
  report: PillarHealthReport;
  mappedProjects: MappedProject[];
}) {
  const [tickerEvents, setTickerEvents] = useState<GlobalNotificationTickerEvent[]>([]);

  const refreshTicker = useCallback(async () => {
    const res = await fetch("/api/msgf/dashboard/ticker", { credentials: "include", cache: "no-store" });
    const json = (await res.json()) as TickerApiResponse;
    if (res.ok && json.ok) {
      setTickerEvents(json.events);
    }
  }, []);

  useEffect(() => {
    void refreshTicker();
    const id = window.setInterval(() => void refreshTicker(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refreshTicker]);

  const defaultProjectLabel = mappedProjects[0]?.label ?? "Your workspace";

  const activities = useMemo(() => {
    const fromTicker: ActivityRow[] = tickerEvents.map((event) => ({
      id: `ticker-${event.id}`,
      projectLabel: defaultProjectLabel,
      message: event.message,
      urgent: tickerUrgent(event.type),
      timestamp: event.timestamp,
      pillar: event.pillar,
      kind: "ticker" as const,
    }));

    const fromPillars = buildPillarActivities(report, mappedProjects);
    return [...fromTicker, ...fromPillars]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [tickerEvents, report, mappedProjects, defaultProjectLabel]);

  const urgentCount = activities.filter((a) => a.urgent).length;

  return (
    <section className="glass-panel rounded-2xl border border-violet-500/25 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Latest activity log
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-50">
            Real-time governance stream
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Each line names the project, what happened, and flags items that need immediate attention.
          </p>
        </div>
        {urgentCount > 0 ? (
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" aria-hidden />
            {urgentCount} urgent
          </span>
        ) : (
          <span className="self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
            No urgent items
          </span>
        )}
      </div>

      <ul className="mt-5 space-y-2">
        {activities.length ? (
          activities.map((row) => (
            <li
              key={row.id}
              className={`rounded-xl border px-4 py-3 transition-colors ${rowStyles(row.urgent)}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">
                  [{row.projectLabel}]
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {row.pillar} · {new Date(row.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-100">{row.message}</p>
              {row.urgent ? (
                <p className="mt-2 text-xs font-semibold text-rose-200">Needs immediate attention</p>
              ) : null}
            </li>
          ))
        ) : (
          <li className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
            No recent activity in the lookback window. Run the IDE extension on a mapped project to
            populate this stream.
          </li>
        )}
      </ul>
    </section>
  );
}
