import { useCallback, useEffect, useState } from "react";

import {
  fetchPendingGlobalPromotions,
  validateCompanyLogicDelta,
  type PendingGlobalPromotionRow,
} from "../lib/msgf-admin-api";

/** COMPANY_ADMIN inbox: LogicDeltas from their org awaiting validation before the global queue. */
export function CompanyLogicDeltaInbox() {
  const [entries, setEntries] = useState<PendingGlobalPromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPendingGlobalPromotions({ limit: 40 });
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company validation inbox.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function validate(row: PendingGlobalPromotionRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await validateCompanyLogicDelta({ cacheId: row.id, tenantId: row.tenant_id });
      setEntries((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">Company validation inbox</h2>
          <p className="text-xs text-amber-200/70">
            Review LogicDeltas from your developers. Validated items become visible to global ops
            for vault promotion (without exposing private keystrokes on their dashboard).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-900/40 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No LogicDeltas awaiting your validation.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="font-medium text-zinc-100">
                    {row.preview.summary_beat ?? "Logic delta"}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-zinc-400">
                    {row.preview.content_snippet}
                  </p>
                  <div className="text-[10px] text-zinc-600">
                    {row.id} · tenant {row.tenant_id} · entity {row.entity_id}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void validate(row)}
                  className="shrink-0 rounded-md border border-amber-800/80 bg-amber-950/50 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-900/50 disabled:opacity-50"
                >
                  {busyId === row.id ? "…" : "Validate for global queue"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
