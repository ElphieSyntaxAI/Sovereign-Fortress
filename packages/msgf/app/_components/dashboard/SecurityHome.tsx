"use client";

import { useEffect, useMemo, useState } from "react";

import { PostIngestHealingConsole } from "@/app/_components/dashboard/PostIngestHealingConsole";
import { SecurityViewSection } from "@/app/_components/dashboard/SecurityViewSection";
import { PillarTerminalDrawer } from "@/app/_components/dashboard/governance-pillar-blocks";
import { fetchHealQueueForTenant } from "@/lib/heal-queue-web-client";
import { healthPillarsQuery } from "@/lib/dashboard-health-scope";
import type { HealQueueGetResponse } from "@/lib/schemas/heal-queue";
import type { PillarLiveLogs } from "@/lib/services/dashboard-orchestration";
import type { PillarHealthEvent, PillarHealthReport } from "@/lib/services/HealthService";
import { PILLAR_CARD_FACE } from "@/lib/pillar-display";
import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";

type Severity = "CRITICAL" | "WARNING" | "INFO";

type LedgerRow = {
  id: string;
  pillar: string;
  title: string;
  summary: string;
  severity: Severity;
  created_at: string;
};

function eventSeverity(event: PillarHealthEvent, stoplight: string): Severity {
  if (event.kind === "vault") return "INFO";
  if (event.kind === "hall" || event.kind === "incident" || event.status === "pending") {
    return stoplight === "red" ? "CRITICAL" : "WARNING";
  }
  return "INFO";
}

export function SecurityHome({
  tenantId,
  projectOrigin,
  allowHumanArbitration,
  mappedProjects,
}: {
  tenantId: string;
  projectOrigin: string;
  allowHumanArbitration: boolean;
  mappedProjects: { project_origin: string; label: string }[];
}) {
  const [report, setReport] = useState<PillarHealthReport | null>(null);
  const [queue, setQueue] = useState<HealQueueGetResponse | null>(null);
  const [healOpen, setHealOpen] = useState(false);
  const [severity, setSeverity] = useState<Severity | "ALL">("ALL");
  const [pillar, setPillar] = useState<string>("ALL");
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<PillarLiveLogs | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(healthPillarsQuery("personal", 168, projectOrigin), { credentials: "include" })
      .then((res) => res.json())
      .then((json: PillarHealthReport & { ok?: boolean; pillars?: PillarHealthReport["pillars"] }) => {
        if (!cancelled && json.ok && Array.isArray(json.pillars)) setReport(json);
      })
      .catch(() => undefined);
    void fetchHealQueueForTenant(tenantId).then((result) => {
      if (!cancelled && result.ok) setQueue(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectOrigin, tenantId]);

  const rows = useMemo(() => {
    const out: LedgerRow[] = [];
    for (const entry of report?.pillars ?? []) {
      for (const event of entry.latest_events ?? []) {
        out.push({
          id: event.id,
          pillar: entry.pillar,
          title: event.title,
          summary: event.summary,
          severity: eventSeverity(event, entry.status),
          created_at: event.created_at,
        });
      }
    }
    return out;
  }, [report]);

  const openCount = rows.filter((row) => row.severity !== "INFO").length;
  const filtered = rows.filter((row) => {
    if (severity !== "ALL" && row.severity !== severity) return false;
    if (pillar !== "ALL" && row.pillar !== pillar) return false;
    return true;
  });

  const vaultTimes = (report?.pillars ?? [])
    .flatMap((entry) => entry.latest_events ?? [])
    .filter((event) => event.kind === "vault")
    .map((event) => event.created_at)
    .sort();
  const lastVault = vaultTimes.at(-1);
  const readiness = queue?.brain_readiness?.readiness_score;
  const scanner = report?.overall_status ?? "green";

  async function openLogs() {
    setLogsOpen(true);
    const res = await fetch("/api/msgf/dashboard/pillar/P1", { credentials: "include" });
    const json = (await res.json()) as { ok?: boolean; logs?: PillarLiveLogs };
    if (res.ok && json.ok && json.logs) setLogs(json.logs);
  }

  return (
    <div className="space-y-6">
      {openCount === 0 ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-4">
            <p className="text-xs uppercase tracking-wider text-emerald-200/80">Active policy coverage</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {readiness == null ? "—" : `${readiness}%`}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-700 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Last Vault sync</p>
            <p className="mt-2 text-sm text-slate-100">
              {lastVault
                ? new Date(lastVault).toLocaleString()
                : "No Vault write in the lookback window."}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-700 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Scanner health</p>
            <p className="mt-2 text-lg font-semibold text-slate-50">{scanner}</p>
          </article>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-50">Static Ledger</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <label>
              Severity{" "}
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity | "ALL")}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </label>
            <label>
              Pillar{" "}
              <select
                value={pillar}
                onChange={(e) => setPillar(e.target.value)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="ALL">All</option>
                {(report?.pillars ?? []).map((entry) => (
                  <option key={entry.pillar} value={entry.pillar}>
                    {PILLAR_CARD_FACE[entry.pillar as MsgfGovernancePillar] ?? entry.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void openLogs()}
              className="rounded-full border border-emerald-500/40 px-3 py-1 text-emerald-100"
            >
              Live logs
            </button>
            <button
              type="button"
              onClick={() => setHealOpen(true)}
              className="rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white"
            >
              Heal
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No open events in this lookback.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Severity</th>
                <th>Pillar</th>
                <th>Event</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="py-2 text-xs font-semibold">{row.severity}</td>
                  <td className="text-slate-300">{row.pillar}</td>
                  <td>
                    <p className="text-slate-100">{row.title}</p>
                    <p className="text-xs text-slate-500">{row.summary}</p>
                  </td>
                  <td className="text-xs text-slate-400">
                    {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {logsOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/80 p-4">
          <div className="mx-auto max-w-5xl">
            <button type="button" className="mb-3 text-sm text-slate-300" onClick={() => setLogsOpen(false)}>
              Close live logs
            </button>
            <PillarTerminalDrawer
              logs={logs}
              actionResult={null}
              onAction={async () => undefined}
              projectLabel={projectOrigin || "All Projects"}
            />
          </div>
        </div>
      ) : null}

      <SecurityViewSection
        healTenantId={tenantId}
        mappedProjects={mappedProjects}
        governance={null}
        controlledOrigin={projectOrigin}
      />

      <PostIngestHealingConsole
        open={healOpen}
        onClose={() => setHealOpen(false)}
        tenantId={tenantId}
        queue={queue}
        pillarFilter={null}
        externalStatus={null}
        onQueueRefresh={() => {
          void fetchHealQueueForTenant(tenantId).then((result) => {
            if (result.ok) setQueue(result.data);
          });
        }}
        allowHumanArbitration={allowHumanArbitration}
        onStatusChange={() => undefined}
      />
    </div>
  );
}
