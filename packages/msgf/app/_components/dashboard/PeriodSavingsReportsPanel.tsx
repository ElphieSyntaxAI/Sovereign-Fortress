"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Last 3 weekly MSGF consumption/savings reports + monthly history data table.
 */

import { useCallback, useEffect, useState } from "react";

import type { PeriodSavingsReportRow } from "@/lib/services/period-savings-reports";

type BundleResponse = {
  ok?: boolean;
  weekly?: PeriodSavingsReportRow[];
  monthly?: PeriodSavingsReportRow[];
  disclaimer?: string;
  error?: string;
};

function fmt(n: number): string {
  return Math.floor(n).toLocaleString();
}

function WeeklyCard({ row }: { row: PeriodSavingsReportRow }) {
  return (
    <article className="rounded-2xl border border-cyan-500/20 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            Weekly report
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-50">{row.period_label}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.period_key} · {row.period_start} → {row.period_end}
          </p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            row.source === "live"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-slate-600 bg-slate-800/80 text-slate-300"
          }`}
        >
          {row.source}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Consumed (metered)</dt>
          <dd className="mt-0.5 font-semibold text-slate-100">{fmt(row.tokens_consumed_metered)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Saved (proven)</dt>
          <dd className="mt-0.5 font-semibold text-emerald-300">{fmt(row.tokens_saved_proven)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Provider calls</dt>
          <dd className="mt-0.5 text-slate-200">{fmt(row.provider_calls)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ops estimate (not eco)</dt>
          <dd className="mt-0.5 text-slate-400">{fmt(row.tokens_saved_estimated)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Shadow projected $</dt>
          <dd className="mt-0.5 font-semibold text-sky-200">
            ${row.shadow_projected_usd.toFixed(4)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-slate-500">
        Eco{" "}
        {row.eco_claimable
          ? `${row.eco_metrics.grid_compute_prevented_kwh} kWh · ${row.eco_metrics.co2e_offset_lbs} lbs CO₂e`
          : "not claimable yet (need proven avoidance)"}
      </p>
    </article>
  );
}

export function PeriodSavingsReportsPanel({ tenantId }: { tenantId?: string }) {
  const [weekly, setWeekly] = useState<PeriodSavingsReportRow[]>([]);
  const [monthly, setMonthly] = useState<PeriodSavingsReportRow[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = tenantId?.trim()
        ? `?tenant_id=${encodeURIComponent(tenantId.trim())}&weekly_count=3&monthly_history=12`
        : "?weekly_count=3&monthly_history=12";
      const res = await fetch(`/api/msgf/dashboard/period-reports${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as BundleResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setWeekly(json.weekly ?? []);
      setMonthly(json.monthly ?? []);
      setDisclaimer(json.disclaimer ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load period reports.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const logNow = useCallback(async () => {
    setLogging(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/dashboard/period-reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId?.trim() || undefined,
          kinds: ["weekly", "monthly"],
        }),
      });
      const json = (await res.json()) as BundleResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setWeekly(json.weekly ?? []);
      setMonthly(json.monthly ?? []);
      setDisclaimer(json.disclaimer ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log period reports.");
    } finally {
      setLogging(false);
    }
  }, [tenantId]);

  const exportPdf = useCallback(
    async (scope: "all" | "weekly" | "monthly" = "all") => {
      setExporting("pdf");
      setError(null);
      try {
        const params = new URLSearchParams({ scope });
        if (tenantId?.trim()) params.set("tenant_id", tenantId.trim());
        const res = await fetch(`/api/msgf/dashboard/period-reports/pdf?${params}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? `PDF export failed (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const stamp = new Date().toISOString().slice(0, 10);
        a.download = `msgf-${scope}-savings-report-${stamp}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "PDF export failed.");
      } finally {
        setExporting(null);
      }
    },
    [tenantId]
  );

  const exportJson = useCallback(() => {
    setExporting("json");
    try {
      const payload = {
        tenant_id: tenantId ?? null,
        generated_at: new Date().toISOString(),
        weekly,
        monthly,
        disclaimer,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `msgf-savings-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }, [tenantId, weekly, monthly, disclaimer]);

  if (loading) {
    return (
      <p className="rounded-2xl border border-slate-800 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-500">
        Loading weekly &amp; monthly savings reports…
      </p>
    );
  }

  return (
    <section
      id="period-savings-reports"
      className="scroll-mt-24 space-y-6 rounded-3xl border border-emerald-500/20 bg-slate-950/40 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            MSGF consumption &amp; savings
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-50 sm:text-2xl">
            Weekly + monthly archive
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Three most recent weekly reports and a monthly history table of what MSGF{" "}
            <strong className="text-slate-200">actually metered</strong> (consumed) versus{" "}
            <strong className="text-emerald-300">proven saved</strong>. Eco columns use proven
            tokens only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportPdf("all")}
            disabled={exporting !== null}
            className="shrink-0 rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
          >
            {exporting === "pdf" ? "Exporting PDF…" : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={exporting !== null}
            className="shrink-0 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {exporting === "json" ? "Exporting…" : "Export JSON"}
          </button>
          <button
            type="button"
            onClick={() => void logNow()}
            disabled={logging || exporting !== null}
            className="shrink-0 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {logging ? "Logging…" : "Log current week + month"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => void exportPdf("weekly")}
          disabled={exporting !== null}
          className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5 text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-50"
        >
          PDF · weekly only
        </button>
        <button
          type="button"
          onClick={() => void exportPdf("monthly")}
          disabled={exporting !== null}
          className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5 text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-50"
        >
          PDF · monthly only
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-slate-200">Last 3 weeks</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {weekly.length ? (
            weekly.map((row) => <WeeklyCard key={row.period_key} row={row} />)
          ) : (
            <p className="text-sm text-slate-500 md:col-span-3">
              No weekly activity yet. Metered CONVERGE / dual / TRI calls will fill these cards.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-200">Monthly history</h3>
        <p className="mt-1 text-xs text-slate-500">
          Logged over time — refresh or “Log current week + month” to snapshot live counters into
          durable rows.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 font-medium">Month</th>
                <th className="px-3 py-3 font-medium">Consumed</th>
                <th className="px-3 py-3 font-medium">Proven saved</th>
                <th className="px-3 py-3 font-medium">Ops est.</th>
                <th className="px-3 py-3 font-medium">Calls</th>
                <th className="px-3 py-3 font-medium">Shadow $</th>
                <th className="px-3 py-3 font-medium">Eco kWh</th>
                <th className="px-3 py-3 font-medium">Logged</th>
              </tr>
            </thead>
            <tbody>
              {monthly.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    No monthly rows yet.
                  </td>
                </tr>
              ) : (
                monthly.map((row) => (
                  <tr
                    key={row.period_key}
                    className="border-t border-slate-800/80 odd:bg-slate-950/40"
                  >
                    <td className="px-3 py-2.5 text-slate-100">
                      <div className="font-medium">{row.period_label}</div>
                      <div className="text-[11px] text-slate-500">{row.period_key}</div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-200">
                      {fmt(row.tokens_consumed_metered)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-emerald-300">
                      {fmt(row.tokens_saved_proven)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-400">
                      {fmt(row.tokens_saved_estimated)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-300">
                      {fmt(row.provider_calls)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-sky-200">
                      ${row.shadow_projected_usd.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-300">
                      {row.eco_claimable
                        ? row.eco_metrics.grid_compute_prevented_kwh.toFixed(4)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {new Date(row.logged_at).toLocaleString()}
                      <span className="ml-1 text-slate-600">({row.source})</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {disclaimer ? (
        <p className="text-[11px] leading-relaxed text-slate-500">{disclaimer}</p>
      ) : null}
    </section>
  );
}
