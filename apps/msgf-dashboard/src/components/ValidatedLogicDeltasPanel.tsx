import { useCallback, useEffect, useState } from "react";

import {
  approveGlobalVaultPromotion,
  fetchPendingGlobalPromotions,
  type PendingGlobalPromotionRow,
} from "../lib/msgf-admin-api";

/**
 * Global ops: LogicDeltas that a COMPANY_ADMIN has validated for vault_core promotion.
 */
export function ValidatedLogicDeltasPanel() {
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
      setError(e instanceof Error ? e.message : "Failed to load validated logic deltas.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function promote(row: PendingGlobalPromotionRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await approveGlobalVaultPromotion({
        cacheId: row.id,
        tenantId: row.tenant_id,
      });
      setEntries((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promotion failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Validated logic deltas</h2>
          <p className="text-xs text-zinc-500">
            Company-approved LogicDeltas ready for global vault DNA — raw developer keystrokes are
            not shown. Snippets are redacted for IP safety.
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

      {error ? (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading queue…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No validated deltas awaiting vault promotion. Company admins validate items from their
          inbox first.
        </p>
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
                    cache {row.id.slice(0, 8)}… · tenant {row.tenant_id.slice(0, 8)}… · validated{" "}
                    {row.company_validated_at
                      ? new Date(row.company_validated_at).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void promote(row)}
                  className="shrink-0 rounded-md border border-emerald-800/80 bg-emerald-950/50 px-2 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-50"
                >
                  {busyId === row.id ? "Promoting…" : "Promote to vault"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
