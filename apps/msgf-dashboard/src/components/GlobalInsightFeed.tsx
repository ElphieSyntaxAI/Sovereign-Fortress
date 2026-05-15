import { useCallback, useEffect, useState } from "react";

import {
  absorbGlobalInsightPattern,
  fetchGlobalInsightFeed,
  type AdminDashboardSession,
  type GlobalInsightFeedItem,
} from "../lib/msgf-admin-api";

type Props = {
  session: AdminDashboardSession | null;
};

/**
 * GLOBAL_ADMIN — cross-tenant feed of successful Sentinel local heals.
 * Patterns are server-anonymized (no raw tenant ids, paths, or domains).
 */
export function GlobalInsightFeed({ session }: Props) {
  const [items, setItems] = useState<GlobalInsightFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isGlobalAdmin = session?.operator_role === "GLOBAL_ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchGlobalInsightFeed({ take: 40, scan: 400 });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Global Insight.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isGlobalAdmin) {
      setItems([]);
      setError(null);
      return;
    }
    void load();
  }, [isGlobalAdmin, load]);

  async function absorb(row: GlobalInsightFeedItem) {
    setBusyId(row.narrative_log_id);
    setError(null);
    try {
      await absorbGlobalInsightPattern({ narrativeLogId: row.narrative_log_id });
      setItems((prev) =>
        prev.map((x) =>
          x.narrative_log_id === row.narrative_log_id ? { ...x, already_absorbed: true } : x
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Absorb failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isGlobalAdmin) {
    return null;
  }

  return (
    <section className="rounded-xl border border-cyan-900/40 bg-cyan-950/15 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-cyan-100">Global Insight</h2>
          <p className="text-xs text-cyan-200/70">
            Successful local heals across tenants — anonymized logic patterns only. File names,
            domains, and identifiers are stripped server-side before display and absorption.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-cyan-800/80 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-900/40 disabled:opacity-50"
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
        <p className="text-sm text-zinc-500">Loading Global Insight…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No recent successful local heals in the scan window.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => (
            <li
              key={row.narrative_log_id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-500">
                <span>silo {row.silo_ref}</span>
                <span>{new Date(row.created_at).toLocaleString()}</span>
                {row.pillar_hint ? <span>pillar {row.pillar_hint}</span> : null}
                {row.drift_score != null ? <span>drift {row.drift_score.toFixed(2)}</span> : null}
                {row.strategy_id ? <span className="truncate">{row.strategy_id}</span> : null}
              </div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-400">
                {row.logic_pattern.trim() || "(no pattern)"}
              </pre>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {row.already_absorbed ? (
                  <span className="text-[11px] font-medium text-emerald-400/90">Absorbed into Global Brain</span>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === row.narrative_log_id}
                    onClick={() => void absorb(row)}
                    className="rounded-md bg-cyan-800/90 px-3 py-1.5 text-[11px] font-medium text-cyan-50 hover:bg-cyan-700 disabled:opacity-50"
                  >
                    Absorb into Global Brain
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
