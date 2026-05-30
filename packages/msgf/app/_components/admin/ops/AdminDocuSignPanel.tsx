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
import { useCallback, useEffect, useState } from "react";

type EnvelopeRow = {
  id: string;
  invite_id: string;
  user_id: string | null;
  email: string | null;
  envelope_id: string;
  signing_url: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
};

type ApiResponse = {
  ok: boolean;
  mode?: string;
  envelopes?: EnvelopeRow[];
  error?: string;
};

export function AdminDocuSignPanel() {
  const [rows, setRows] = useState<EnvelopeRow[]>([]);
  const [mode, setMode] = useState<string>("—");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/docusign/envelopes", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRows(json.envelopes ?? []);
      setMode(json.mode ?? "—");
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load DocuSign envelopes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = rows.filter((r) => r.status === "sent").length;

  return (
    <section
      id="docusign-compliance"
      className="glass-panel scroll-mt-24 rounded-2xl border border-amber-500/25 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/90">
            Team compliance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">DocuSign envelopes</h2>
          <p className="mt-2 text-sm text-slate-400">
            Mode: <span className="font-mono text-amber-200">{mode}</span>
            {mode === "mock" ? (
              <>
                {" "}
                — invitees complete via{" "}
                <code className="text-violet-300">POST /api/msgf/workspace/docusign/mock-complete</code>{" "}
                or the workspace banner.
              </>
            ) : null}
            {mode === "live" ? (
              <> — Connect webhook: <code className="text-violet-300">POST /api/msgf/ops/docusign-webhook</code></>
            ) : null}
            {mode === "unconfigured" ? (
              <>
                {" "}
                — Admin ops and ARBITRATE work without DocuSign keys. Add{" "}
                <code className="text-violet-300">DOCUSIGN_*</code> (or{" "}
                <code className="text-violet-300">MSGF_DOCUSIGN_MOCK=1</code> locally) only when you
                enforce signing on team invites.
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-sm text-slate-400">
        <strong className="text-slate-200">{pending}</strong> pending signature
        {pending === 1 ? "" : "s"} · <strong className="text-slate-200">{rows.length}</strong> total
        tracked
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading envelopes…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No envelopes yet. Send a team invite with DocuSign enforced.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700/80 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Envelope</th>
                <th className="px-2 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/60 text-slate-300">
                  <td className="px-2 py-2">{row.email ?? row.user_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-2 py-2">
                    <span
                      className={
                        row.status === "completed"
                          ? "text-emerald-300"
                          : row.status === "declined"
                            ? "text-rose-300"
                            : "text-amber-200"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-slate-500">
                    {row.envelope_id.slice(0, 20)}…
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
