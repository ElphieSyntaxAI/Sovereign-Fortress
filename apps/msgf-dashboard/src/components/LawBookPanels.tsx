import { useCallback, useEffect, useState } from "react";

import {
  fetchGlobalLawBookExcerpts,
  fetchLocalLawBookExcerpts,
  type LawBookExcerptDto,
} from "../lib/msgf-admin-api";

/** COMPANY / tenant ops — tenant vault excerpts only (API enforces). */
export function LocalLawBookPanel() {
  const tenantId = import.meta.env.VITE_MSGF_LAW_BOOK_TENANT_ID?.trim() ?? "";
  const [rows, setRows] = useState<LawBookExcerptDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const excerpts = await fetchLocalLawBookExcerpts({ tenantId, limit: 35 });
      setRows(excerpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Local Law Book.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tenantId) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Local Law Book</h2>
        <p className="mt-2 text-xs text-zinc-500">
          Set <code className="text-zinc-400">VITE_MSGF_LAW_BOOK_TENANT_ID</code> to your project
          vault tenant id. Company operators only see the tenant vault (Book 2); global core law is
          hidden here by design.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-teal-900/40 bg-teal-950/10 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-teal-100">Local Law Book</h2>
          <p className="text-xs text-teal-200/70">
            Tenant vault (editable business logic). Global core laws are not listed in this panel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-teal-800/80 bg-teal-950/40 px-3 py-1.5 text-xs text-teal-100 hover:bg-teal-900/40 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No vault excerpts for this tenant.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto text-xs text-zinc-300">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-2">
              <div className="font-mono text-[10px] text-zinc-500">{r.id}</div>
              <p className="mt-1 whitespace-pre-wrap break-words">{r.content.slice(0, 520)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** GLOBAL ops — read-only global vault (Book 1) excerpts. */
export function GlobalLawBookPanel() {
  const [rows, setRows] = useState<LawBookExcerptDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const excerpts = await fetchGlobalLawBookExcerpts({ limit: 35 });
      setRows(excerpts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Global Law Book.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-sky-900/40 bg-sky-950/10 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-sky-100">Global Law Book (read-only)</h2>
          <p className="text-xs text-sky-200/70">Core Hall / global_vault — precedence over conflicting tenant rules during Pulse.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-sky-800/80 bg-sky-950/40 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-900/40 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No global vault excerpts.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto text-xs text-zinc-300">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-2">
              <div className="font-mono text-[10px] text-zinc-500">{r.id}</div>
              <p className="mt-1 whitespace-pre-wrap break-words">{r.content.slice(0, 420)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
