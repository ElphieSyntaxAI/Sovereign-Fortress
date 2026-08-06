"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Shadow Proxy projected savings strip for Reports / token savings.
 */

import { useCallback, useEffect, useState } from "react";

type Summary = {
  evaluation_count: number;
  actual_cost_usd: number;
  projected_savings_usd: number;
};

type RecentRow = {
  recommended_action?: string;
  savings_potential_usd?: number;
  endpoint?: string;
  model?: string;
  observed_at?: string;
};

export function ShadowProxySavingsPanel({ tenantId }: { tenantId?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = tenantId?.trim()
        ? `?tenant_id=${encodeURIComponent(tenantId.trim())}`
        : "";
      const res = await fetch(`/api/msgf/dashboard/shadow-eval${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        summary?: Summary;
        recent?: RecentRow[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setSummary(json.summary ?? null);
      setRecent(json.recent ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shadow eval.");
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-500">
        Shadow Proxy panel unavailable ({error}). Point OpenAI/Anthropic SDKs at{" "}
        <code className="text-slate-400">/api/v1</code> with{" "}
        <code className="text-slate-400">x-msgf-mode: shadow</code>.
      </p>
    );
  }

  if (!summary) return null;

  return (
    <section
      id="shadow-proxy-savings"
      className="scroll-mt-24 rounded-2xl border border-sky-500/25 bg-sky-950/20 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">
        Shadow Proxy (projected)
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">
        Bill-drop proof from pass-through traffic
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Zero-latency shadow mode forwards to the provider immediately, then simulates MSGF
        optimizations in the background. These dollars are{" "}
        <strong className="text-sky-200">projected</strong> — not proven eco.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Evals (24h)</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-100">
            {summary.evaluation_count.toLocaleString()}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">
            Actual pass-through $
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-100">
            ${summary.actual_cost_usd.toFixed(4)}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <dt className="text-[11px] uppercase tracking-wide text-emerald-200/80">
            Projected savings $
          </dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-200">
            ${summary.projected_savings_usd.toFixed(4)}
          </dd>
        </div>
      </dl>
      {recent.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-xs text-slate-400">
          {recent.slice(0, 5).map((row, i) => (
            <li key={`${row.observed_at ?? i}-${i}`}>
              <span className="text-sky-200">{row.recommended_action ?? "KEEP_AS_IS"}</span>
              {" · "}${Number(row.savings_potential_usd ?? 0).toFixed(4)}
              {" · "}
              {row.endpoint ?? "?"} / {row.model ?? "?"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          No shadow evaluations yet. Point SDKs at{" "}
          <code className="text-slate-400">/api/v1</code> with{" "}
          <code className="text-slate-400">x-msgf-mode: shadow</code> — see{" "}
          <code className="text-slate-400">docs/MSGF_SHADOW_PROXY.md</code>.
        </p>
      )}
    </section>
  );
}
