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

type QuarantineRow = {
  id: string;
  quarantine_status: string | null;
  quarantine_reason: string | null;
  quarantine_sentry_issue_id: string | null;
  quarantine_at: string | null;
  project_origin: string | null;
  company_id: string | null;
  content_preview: string;
};

type ListPayload = {
  ok?: boolean;
  error?: string;
  count?: number;
  rows?: QuarantineRow[];
};

export function AdminVaultQuarantinePanel() {
  const [rows, setRows] = useState<QuarantineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/vault-quarantine?limit=40", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ListPayload;
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRows(json.rows ?? []);
      setMessage(`Loaded ${json.count ?? 0} quarantined win(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quarantine queue.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(vectorId: string, action: "DEMOTE_TO_HALL" | "RESTORE_TO_VAULT") {
    setActingId(vectorId);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/vault-quarantine", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vector_id: vectorId,
          action,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; status?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setMessage(`${action === "DEMOTE_TO_HALL" ? "Demoted" : "Restored"} → ${json.status}.`);
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="glass-panel rounded-2xl border border-amber-500/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
            Vault HITL
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Quarantine review</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Sentry-matched Vault wins wait here. Demote writes Hall + blocks retrieval; restore
            returns the row to eligible Vault use. Operators only — no auto-Hall.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Optional note (audit)
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why demote or restore…"
          className="w-full rounded-lg border border-amber-500/20 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/50"
        />
      </label>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-xs text-slate-500">{message}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No quarantined Vault wins right now.</p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-slate-700/80 bg-slate-950/50 px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-mono text-xs text-amber-200/90">{row.id}</p>
                <p className="text-sm text-slate-200">{row.content_preview || "(empty content)"}</p>
                <p className="text-xs text-slate-500">
                  Sentry {row.quarantine_sentry_issue_id ?? "—"} ·{" "}
                  {row.project_origin ?? "no project"} · {row.quarantine_at ?? "—"}
                </p>
                {row.quarantine_reason ? (
                  <p className="text-xs text-slate-400">{row.quarantine_reason}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actingId === row.id}
                  onClick={() => void act(row.id, "RESTORE_TO_VAULT")}
                  className="rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
                >
                  Restore
                </button>
                <button
                  type="button"
                  disabled={actingId === row.id}
                  onClick={() => void act(row.id, "DEMOTE_TO_HALL")}
                  className="rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  Demote to Hall
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
