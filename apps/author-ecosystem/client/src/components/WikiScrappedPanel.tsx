import { useCallback, useEffect, useState } from "react";

import { fetchScrappedWiki, restoreWikiEntry } from "../lib/wikiEntryClient";
import { getOutlineLoreKindConfig } from "../lib/outlineLoreKinds";
import type { OutlineLoreKind } from "../lib/outlineLoreKinds";

type ScrappedRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function titleFromRow(row: ScrappedRow): string {
  const t = row.metadata.proposed_chunk_title;
  if (typeof t === "string" && t.trim()) return t;
  const m = row.content.match(/^##\s+(.+)$/m);
  return m?.[1]?.trim() || "Untitled";
}

function kindFromMeta(meta: Record<string, unknown>): string {
  return String(meta.outline_entity_kind ?? meta.lore_extraction_chunk_type ?? "entry");
}

export function WikiScrappedPanel(props: {
  manuscriptId: string;
  onStatus?: (message: string) => void;
  onReloadWiki?: () => void;
}) {
  const [rows, setRows] = useState<ScrappedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetchScrappedWiki(props.manuscriptId);
      setRows(json.scrapped ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [props.manuscriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      await restoreWikiEntry(props.manuscriptId, id);
      props.onStatus?.("Entry restored from Scrapped ideas.");
      props.onReloadWiki?.();
      await load();
    } catch (e) {
      props.onStatus?.(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (!open && rows.length === 0 && !loading) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-sm font-semibold text-zinc-200">Scrapped ideas</h3>
          <span className="text-xs text-zinc-500">Show · 0 items</span>
        </button>
        <p className="mt-1 text-xs text-zinc-500">
          Removed wiki articles land here. Restore anytime — permanent delete is not exposed in the UI yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-sm font-semibold text-zinc-200">Scrapped ideas</h3>
        <span className="text-xs text-zinc-500">
          {open ? "Hide" : "Show"} · {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
      </button>
      <p className="mt-1 text-xs text-zinc-500">
        Soft-deleted wiki entries kept for author recovery. Use <strong className="font-medium text-zinc-400">Remove</strong> on an article or{" "}
        <strong className="font-medium text-zinc-400">Remove from wiki</strong> in the lore sheet.
      </p>

      {open ? (
        <div className="mt-3">
          {loading ? (
            <p className="text-xs text-zinc-500">Loading scrapped entries…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-zinc-500">No scrapped entries for this manuscript.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const kind = kindFromMeta(row.metadata);
                let label = kind;
                try {
                  label = getOutlineLoreKindConfig(kind as OutlineLoreKind).label;
                } catch {
                  /* use raw kind */
                }
                const scrappedAt = String(row.metadata.wiki_scrapped_at ?? "");
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div>
                      <p className="text-xs font-medium text-zinc-100">{titleFromRow(row)}</p>
                      <p className="text-[10px] text-zinc-500">
                        {label}
                        {scrappedAt ? ` · scrapped ${new Date(scrappedAt).toLocaleString()}` : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void restore(row.id)}
                      className="rounded-full border border-emerald-700/50 px-2 py-1 text-[10px] text-emerald-200 disabled:opacity-50"
                    >
                      {busyId === row.id ? "Restoring…" : "Restore"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
