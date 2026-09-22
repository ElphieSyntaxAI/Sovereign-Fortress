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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T160051Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T155844Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T154800Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T073711Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T072718Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T071103Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T065535Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */

import { useCallback, useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  trace_id: string;
  decision_kind: string;
  routing: string | null;
  logic_drift_score: number | null;
  defend_tier: string | null;
  defend_reason: string | null;
  outcome: string;
  observed_at: string;
  sources: Array<{
    resource_key?: string;
    content_hash?: string | null;
    file_path?: string | null;
    pruned?: boolean;
    attribution_class?: string;
    score?: number;
  }>;
};

type ReputationRow = {
  resource_key: string;
  ledger: string;
  file_path: string | null;
  reputation_score: number;
  good_count: number;
  bad_count: number;
  high_drift_count: number;
};

type ImpactRow = {
  trace_id: string;
  project_origin: string | null;
  resource_key: string;
  content_hash: string;
  attribution_class: string;
  file_path: string | null;
  observed_at: string;
};

type Props = {
  tenantId: string;
};

export function SourceAuditPanel({ tenantId }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [preferred, setPreferred] = useState<ReputationRow[]>([]);
  const [demoted, setDemoted] = useState<ReputationRow[]>([]);
  const [impact, setImpact] = useState<ImpactRow[]>([]);
  const [lookup, setLookup] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"audit" | "rank">("audit");
  const [rankQ, setRankQ] = useState("");
  const [rankings, setRankings] = useState<
    Array<{
      resource_key: string;
      uses: number;
      last_used: string;
      kind_sample: string | null;
      product_sample: string | null;
    }>
  >([]);

  const loadForward = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/msgf/dashboard/source-audit?tenant_id=${encodeURIComponent(tenantId)}&limit=12`,
        { credentials: "include", cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        events?: AuditEvent[];
        preferred?: ReputationRow[];
        demoted?: ReputationRow[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setEvents(json.events ?? []);
      setPreferred(json.preferred ?? []);
      setDemoted(json.demoted ?? []);
      setImpact([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load source audit.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadForward();
  }, [loadForward]);

  const runImpact = async () => {
    const q = lookup.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const param = /^[0-9a-f]{64}$/i.test(q)
        ? `content_hash=${encodeURIComponent(q)}`
        : `resource_key=${encodeURIComponent(q)}`;
      const res = await fetch(
        `/api/msgf/dashboard/source-audit?tenant_id=${encodeURIComponent(tenantId)}&${param}&since_days=90`,
        { credentials: "include", cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        impact?: ImpactRow[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setImpact(json.impact ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impact lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadRank = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenant_id: tenantId,
        mode: "rank",
        since_days: "30",
        limit: "20",
      });
      if (rankQ.trim()) params.set("q", rankQ.trim());
      const res = await fetch(`/api/msgf/dashboard/source-audit?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        rankings?: typeof rankings;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRankings(json.rankings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rank load failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="source-audit"
      className="glass-panel rounded-2xl border border-cyan-500/20 p-5 sm:p-6"
      aria-label="Source audit and provenance"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            Pillar 7 · Source audit &amp; provenance
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
            Why the AI chose these sources
          </h2>
          <p className="mt-2 max-w-2xl text-xs text-slate-500">
            Content hashes prove the exact chunk used. Impact lookup finds every trace that cited a
            bad or deprecated source. Most-used ranks hashed resource usage across products.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("audit")}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              tab === "audit"
                ? "border-cyan-500/50 text-cyan-200"
                : "border-slate-600/50 text-slate-300 hover:bg-white/5"
            }`}
          >
            Audit
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("rank");
              void loadRank();
            }}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              tab === "rank"
                ? "border-cyan-500/50 text-cyan-200"
                : "border-slate-600/50 text-slate-300 hover:bg-white/5"
            }`}
          >
            Most used
          </button>
          <button
            type="button"
            onClick={() => void (tab === "rank" ? loadRank() : loadForward())}
            className="rounded-full border border-slate-600/50 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading source audit…</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {tab === "rank" ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={rankQ}
              onChange={(e) => setRankQ(e.target.value)}
              placeholder="Filter resource_key (raw queries never stored)"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200"
            />
            <button
              type="button"
              onClick={() => void loadRank()}
              className="rounded-xl border border-cyan-500/40 px-3 py-2 text-xs text-cyan-100"
            >
              Search ranks
            </button>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {rankings.length === 0 ? (
              <li className="text-slate-500">No usage rankings yet.</li>
            ) : (
              rankings.map((r) => (
                <li
                  key={r.resource_key}
                  className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2"
                >
                  <p className="truncate font-mono text-xs text-slate-200">{r.resource_key}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.uses} uses · {r.kind_sample ?? "—"} · {r.product_sample ?? "—"} ·{" "}
                    {new Date(r.last_used).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {tab === "audit" ? (
      <>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recent decisions
          </h3>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
            {events.length === 0 ? (
              <li className="text-slate-500">No audit events yet.</li>
            ) : (
              events.map((ev) => {
                const used = (ev.sources ?? []).filter((s) => !s.pruned).length;
                const pruned = (ev.sources ?? []).filter((s) => s.pruned).length;
                return (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-2"
                  >
                    <p className="font-medium text-slate-200">
                      {ev.outcome} · {ev.defend_tier ?? "—"} · {ev.decision_kind}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ev.defend_reason ?? "—"} · used {used} · pruned {pruned}
                      {ev.logic_drift_score != null
                        ? ` · drift ${Number(ev.logic_drift_score).toFixed(2)}`
                        : ""}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-600">
                      {ev.trace_id}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">
              Preferred sources
            </h3>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {preferred.length === 0 ? (
                <li>None yet.</li>
              ) : (
                preferred.slice(0, 5).map((r) => (
                  <li key={r.resource_key} className="truncate font-mono">
                    {r.reputation_score.toFixed(2)} · {r.file_path || r.resource_key}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              Demoted / quarantine
            </h3>
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {demoted.length === 0 ? (
                <li>None below −0.3.</li>
              ) : (
                demoted.slice(0, 5).map((r) => (
                  <li key={r.resource_key} className="truncate font-mono">
                    {r.reputation_score.toFixed(2)} · {r.file_path || r.resource_key}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800/80 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
          Impact lookup (90d)
        </h3>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="content_hash (64 hex) or resource_key"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200"
          />
          <button
            type="button"
            onClick={() => void runImpact()}
            className="rounded-full bg-violet-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Trace impact
          </button>
        </div>
        {impact.length > 0 ? (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-slate-400">
            {impact.map((row, i) => (
              <li key={`${row.trace_id}-${i}`}>
                {row.observed_at.slice(0, 19)} · {row.trace_id.slice(0, 12)}…
                {row.project_origin ? ` · ${row.project_origin}` : ""} ·{" "}
                {row.attribution_class}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      </>
      ) : null}
    </section>
  );
}
