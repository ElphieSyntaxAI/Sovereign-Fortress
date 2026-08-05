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
import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  source: string;
  project_origin: string;
  incident_id: string | null;
  operator_id: string | null;
  action: string;
  signature: string;
  prev_hash: string;
  row_hash: string;
  created_at: string;
  payload_json: unknown;
};

type ListPayload = {
  ok?: boolean;
  error?: string;
  count?: number;
  rows?: AuditRow[];
};

export function AdminArbitrateAuditPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "30" });
      if (originFilter.trim()) q.set("project_origin", originFilter.trim());
      const res = await fetch(`/api/msgf/admin/arbitrate-audit?${q}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ListPayload;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRows(json.rows ?? []);
      setMessage(`Loaded ${json.count ?? 0} ARBITRATE audit row(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audits.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [originFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function downloadRow(row: AuditRow) {
    const blob = new Blob([JSON.stringify(row, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `msgf-arbitrate-audit-${row.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function verifyRow(id: string) {
    setVerifyingId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/msgf/admin/arbitrate-audit/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        signature_ok?: boolean;
        row_hash_ok?: boolean;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      if (json.ok) {
        setMessage(`Verified ${id.slice(0, 8)}… — signature + row hash OK.`);
      } else {
        setError(
          json.error ??
            `Verify failed (sig=${String(json.signature_ok)} hash=${String(json.row_hash_ok)}).`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed.");
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <section className="glass-panel rounded-2xl border border-emerald-500/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            ARBITRATE A6
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Signed HITL audit</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Each resolve appends HMAC-signed JSON with a hash chain (
            <code className="text-slate-300">prev_hash</code> →{" "}
            <code className="text-slate-300">row_hash</code>). Tamper fails verify.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          placeholder="Filter project_origin"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-emerald-700/80 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Apply
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-300/90">{message}</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No ARBITRATE audit rows yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800/80 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-slate-200">{row.project_origin}</span>
                <time className="text-xs text-slate-500">{row.created_at}</time>
              </div>
              <p className="mt-1 text-slate-400">
                <span className="text-emerald-300/90">{row.action}</span>
                <span className="ml-2 text-xs text-slate-500">{row.source}</span>
                {row.incident_id ? (
                  <span className="ml-2 font-mono text-xs">inc: {row.incident_id.slice(0, 8)}</span>
                ) : null}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-600">
                hash: {row.row_hash.slice(0, 16)}… · prev: {row.prev_hash.slice(0, 16)}…
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={verifyingId === row.id}
                  onClick={() => void verifyRow(row.id)}
                  className="rounded-md border border-emerald-600/50 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50"
                >
                  {verifyingId === row.id ? "Verifying…" : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => downloadRow(row)}
                  className="rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Download JSON
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
