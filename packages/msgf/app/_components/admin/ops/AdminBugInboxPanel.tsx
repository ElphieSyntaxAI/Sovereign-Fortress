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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T170731Z-internal
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

type InboxStatus = "open" | "promoted" | "dismissed" | "all";

type BugRow = {
  id: string;
  tenant_id: string;
  error_message: string;
  location: string;
  severity: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  inbox_status: "open" | "promoted" | "dismissed";
  promoted_msgf_incident_id: string | null;
  inbox_note: string | null;
};

export function AdminBugInboxPanel() {
  const [status, setStatus] = useState<InboxStatus>("open");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<BugRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status,
        limit: "40",
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/msgf/admin/bug-inbox?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        rows?: BugRow[];
        count?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRows(json.rows ?? []);
      setCount(json.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bug inbox.");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "promote" | "dismiss") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/bug-inbox", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          note: noteById[id]?.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      id="bug-inbox"
      className="glass-panel rounded-2xl border border-amber-500/25 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
            Closed loop
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-100">Bug inbox</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Onscreen bug FAB (MsgfSentinel), web BugReporter, and{" "}
            <code className="text-violet-300/90">POST /api/msgf/report-issue</code> land in{" "}
            <code className="text-violet-300/90">p4_active_incidents</code>. Promote into ARBITRATE
            or dismiss. {count} matching.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["open", "promoted", "dismissed", "all"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatus(tab)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
              status === tab
                ? "bg-amber-500/25 text-amber-100"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
          placeholder="Search message / location / tenant"
          className="min-w-[14rem] flex-1 rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs text-slate-100"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-amber-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
        >
          Search
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Loading bug inbox…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No {status === "all" ? "" : status} reports.</p>
      ) : (
        <ul className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/55 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100">
                    {row.error_message.slice(0, 220)}
                    {row.error_message.length > 220 ? "…" : ""}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-zinc-500">
                    {row.tenant_id} · {row.location || "(no location)"} · ×
                    {row.occurrence_count} · {row.severity} · {row.inbox_status}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    Last seen {new Date(row.last_seen_at).toLocaleString()}
                    {row.promoted_msgf_incident_id
                      ? ` · msgf ${row.promoted_msgf_incident_id.slice(0, 8)}…`
                      : ""}
                  </p>
                </div>
              </div>

              {row.inbox_status === "open" ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={noteById[row.id] ?? ""}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    placeholder="Optional operator note"
                    className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, "promote")}
                    className="rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Promote to ARBITRATE
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, "dismiss")}
                    className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              ) : row.inbox_note ? (
                <p className="mt-2 text-xs text-zinc-400">Note: {row.inbox_note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
