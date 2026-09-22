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
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type MatchSource = {
  resource_key: string;
  file_path: string | null;
  score: number | null;
  content_hash: string | null;
  attribution_class: string | null;
  reputation_score: number | null;
  ledger: string | null;
};

type ProvenanceMatch = {
  trace_id: string;
  tenant_id: string;
  project_origin: string | null;
  observed_at: string;
  outcome: string;
  defend_tier: string | null;
  routing: string | null;
  logic_drift_score: number | null;
  prompt_summary: string | null;
  vault: unknown[];
  hall: unknown[];
  hal: unknown[];
  sources: MatchSource[];
};

type SearchPayload = {
  ok?: boolean;
  error?: string;
  matches?: ProvenanceMatch[];
};

function trustLabel(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  const n = Number(score);
  if (n >= 0.3) return `${n.toFixed(2)} preferred`;
  if (n <= -0.3) return `${n.toFixed(2)} demoted`;
  return n.toFixed(2);
}

export function AdminProvenanceSearchPanel() {
  const searchParams = useSearchParams();
  const urlOrigin = searchParams?.get("project_origin")?.trim() || "";

  const [q, setQ] = useState("");
  const [projectOrigin, setProjectOrigin] = useState(urlOrigin);
  const [contentHash, setContentHash] = useState("");
  const [traceId, setTraceId] = useState("");
  const [matches, setMatches] = useState<ProvenanceMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setProjectOrigin(urlOrigin);
  }, [urlOrigin]);

  const runSearch = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (projectOrigin.trim()) params.set("project_origin", projectOrigin.trim());
    if (contentHash.trim()) params.set("content_hash", contentHash.trim());
    if (traceId.trim()) params.set("trace_id", traceId.trim());
    params.set("limit", "25");

    if (
      !q.trim() &&
      !projectOrigin.trim() &&
      !contentHash.trim() &&
      !traceId.trim()
    ) {
      setError("Enter at least one search field.");
      setMatches([]);
      setSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/msgf/admin/provenance-search?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as SearchPayload;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setMatches(json.matches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provenance search failed.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [q, projectOrigin, contentHash, traceId]);

  return (
    <section
      id="provenance"
      className="glass-panel rounded-2xl border border-cyan-500/25 p-5 sm:p-6"
      aria-label="Provenance search"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Pillar 7
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Provenance search</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Trace Vault / Hall / HAL influence and source reputation by project, hash, or
            trace id.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Search
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="q (trace, reason, routing…)"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={projectOrigin}
          onChange={(e) => setProjectOrigin(e.target.value)}
          placeholder="project_origin"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={contentHash}
          onChange={(e) => setContentHash(e.target.value)}
          placeholder="content_hash"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
        />
        <input
          value={traceId}
          onChange={(e) => setTraceId(e.target.value)}
          placeholder="trace_id"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-100"
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Searching…</p>
      ) : !searched ? (
        <p className="mt-4 text-sm text-slate-500">Enter filters and search.</p>
      ) : matches.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No matches.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {matches.map((m) => (
            <li
              key={`${m.trace_id}-${m.observed_at}`}
              className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-100">
                  {m.outcome}
                  {m.defend_tier ? ` · ${m.defend_tier}` : ""}
                  {m.routing ? ` · ${m.routing}` : ""}
                </p>
                <time className="text-xs text-slate-500">{m.observed_at}</time>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-400">{m.trace_id}</p>
              <p className="mt-1 text-xs text-slate-500">
                tenant: {m.tenant_id}
                {m.project_origin ? ` · origin: ${m.project_origin}` : ""}
                {m.logic_drift_score != null
                  ? ` · drift ${Number(m.logic_drift_score).toFixed(2)}`
                  : ""}
              </p>
              {m.prompt_summary ? (
                <p className="mt-2 text-slate-300">{m.prompt_summary}</p>
              ) : null}

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    Vault ({m.vault?.length ?? 0})
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(m.vault?.length ?? 0) === 0 ? "—" : `${m.vault.length} vector(s)`}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
                    Hall ({m.hall?.length ?? 0})
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(m.hall?.length ?? 0) === 0 ? "—" : `${m.hall.length} vector(s)`}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">
                    HAL ({m.hal?.length ?? 0})
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(m.hal?.length ?? 0) === 0 ? "—" : `${m.hal.length} row(s)`}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300/80">
                  Sources
                </p>
                {(m.sources ?? []).length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">No sources.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-800/80">
                    {m.sources.map((s, idx) => (
                      <li key={`${s.resource_key}-${idx}`} className="py-2">
                        <p className="font-mono text-xs text-slate-200">
                          {s.resource_key || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          trust: {trustLabel(s.reputation_score)}
                          {s.ledger ? ` · ${s.ledger}` : ""}
                          {s.attribution_class ? ` · ${s.attribution_class}` : ""}
                          {s.score != null ? ` · score ${s.score}` : ""}
                        </p>
                        {s.file_path ? (
                          <p className="mt-0.5 truncate text-xs text-slate-500">{s.file_path}</p>
                        ) : null}
                        {s.content_hash ? (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
                            {s.content_hash}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
