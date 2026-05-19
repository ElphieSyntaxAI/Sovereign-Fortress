import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { useNarrative } from "../context/NarrativeContext";
export type ManuscriptRow = {
  id: string;
  tenant_id: string;
  title: string | null;
  revision_status: string | null;
  updated_at: string | null;
  lock_expires_at?: string | null;
  revision_cooldown_until?: string | null;
  cooldown_revision_status?: string | null;
  locked_until?: string | null;
  cooldown_duration?: string | null;
};

export function ManuscriptSelector() {
  const { selection, setSelection } = useNarrative();
  const [rows, setRows] = useState<ManuscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/manuscripts"), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      if (res.status === 401 || res.status === 403) {
        setError("Session expired — sign in again.");
        setRows([]);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        manuscripts?: ManuscriptRow[];
      };
      if (!res.ok) {
        throw new Error(json.error || res.statusText);
      }
      setRows(Array.isArray(json.manuscripts) ? json.manuscripts : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) {
      setSelection(null);
      return;
    }
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSelection({
      manuscriptId: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      revision_status: row.revision_status,
      cooldown_revision_status: row.cooldown_revision_status,
      locked_until: row.locked_until,
      lock_expires_at: row.lock_expires_at,
      revision_cooldown_until: row.revision_cooldown_until,
    });
    try {
      const token = await getPreferredBffBearer();
      await fetch(bffUrl(`/api/manuscripts/${encodeURIComponent(row.id)}/touch`), {
        method: "POST",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
    } catch {
      /* non-fatal: active-manuscript ordering best-effort */
    }
  };

  const selectValue = selection?.manuscriptId ?? "";

  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Manuscript</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200"
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading manuscripts…</p>
      ) : error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No manuscripts found for your account. Create rows in{" "}
          <code className="text-zinc-300">p4_manuscripts</code> with{" "}
          <code className="text-zinc-300">tenant_id</code> equal to your user id.
        </p>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Select manuscript
          </span>
          <select
            className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            value={selectValue}
            onChange={onChange}
          >
            <option value="">— Choose —</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {(r.title && r.title.trim()) || "Untitled"} · {r.revision_status ?? "—"} ·{" "}
                {r.updated_at ? new Date(r.updated_at).toLocaleString() : ""}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
