import { useCallback, useEffect, useState } from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

type MergeSide = {
  title: string;
  excerpt: string;
  ref_label?: string;
  chunk_id?: string;
};

type LoreMerge = {
  id: string;
  status: string;
  reason: string;
  base: MergeSide;
  incoming: MergeSide;
  continuity_note?: string;
  created_at?: string;
};

export function WikiLoreMergesPanel(props: { manuscriptId: string }) {
  const [merges, setMerges] = useState<LoreMerge[]>([]);
  const [selected, setSelected] = useState<LoreMerge | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const [listRes, noteRes] = await Promise.all([
        fetch(
          bffUrl(
            `/api/wiki/merges?manuscript_id=${encodeURIComponent(props.manuscriptId)}&status=open`
          ),
          { ...bffCredentials, headers: { ...bffAuthHeaders(token) } }
        ),
        fetch(
          bffUrl(
            `/api/wiki/merges/notifications?manuscript_id=${encodeURIComponent(props.manuscriptId)}`
          ),
          { ...bffCredentials, headers: { ...bffAuthHeaders(token) } }
        ),
      ]);
      const listJson = (await listRes.json()) as { merges?: LoreMerge[]; error?: string };
      const noteJson = (await noteRes.json()) as { unread?: number; open?: number };
      if (!listRes.ok) throw new Error(listJson.error || `Failed to load merges (${listRes.status})`);
      setMerges(Array.isArray(listJson.merges) ? listJson.merges : []);
      setUnread(Number(noteJson.unread ?? noteJson.open ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [props.manuscriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (
    action: "keep_base" | "accept_incoming" | "edit_merge" | "dismiss"
  ) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl(`/api/wiki/merges/${encodeURIComponent(selected.id)}/resolve`), {
        method: "POST",
        ...bffCredentials,
        headers: { "Content-Type": "application/json", ...bffAuthHeaders(token) },
        body: JSON.stringify({
          action,
          edited:
            action === "edit_merge"
              ? { title: editTitle || selected.incoming.title, excerpt: editExcerpt }
              : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Resolve failed (${res.status})`);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const markRead = async () => {
    try {
      const token = await getPreferredBffBearer();
      await fetch(bffUrl("/api/wiki/merges/notifications/read"), {
        method: "POST",
        ...bffCredentials,
        headers: { "Content-Type": "application/json", ...bffAuthHeaders(token) },
        body: JSON.stringify({ manuscript_id: props.manuscriptId }),
      });
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-amber-800/40 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            Lore Merges
            {merges.length > 0 ? (
              <span className="ml-2 rounded-full bg-amber-600/30 px-2 py-0.5 text-[10px] text-amber-100">
                {merges.length} open
              </span>
            ) : null}
            {unread > 0 ? (
              <span className="ml-1 rounded-full bg-red-700/50 px-2 py-0.5 text-[10px] text-red-100">
                {unread} new
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Git-style review when new lore conflicts with similar existing facts. Each side shows its
            Ref (planning upload, manual, or live manuscript).
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markRead()}
              className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400"
            >
              Mark notifications read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      {merges.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-600">No open lore conflicts.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {merges.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(m);
                  setEditTitle(m.incoming.title);
                  setEditExcerpt(m.incoming.excerpt);
                }}
                className={[
                  "w-full rounded-lg border px-3 py-2 text-left text-xs transition",
                  selected?.id === m.id
                    ? "border-amber-500/50 bg-amber-950/30"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600",
                ].join(" ")}
              >
                <span className="font-medium text-zinc-200">{m.incoming.title}</span>
                <span className="ml-2 text-[10px] text-zinc-500">{m.reason.replace(/_/g, " ")}</span>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                  <span>{m.base.ref_label ?? "Ref: existing"}</span>
                  <span>vs</span>
                  <span>{m.incoming.ref_label ?? "Ref: incoming"}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Existing (base)
            </p>
            <p className="mt-1 text-xs text-emerald-200/80">{selected.base.ref_label}</p>
            <p className="mt-2 text-sm font-medium text-zinc-100">{selected.base.title}</p>
            <p className="mt-1 text-xs text-zinc-400 whitespace-pre-wrap">{selected.base.excerpt}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Incoming
            </p>
            <p className="mt-1 text-xs text-sky-200/80">{selected.incoming.ref_label}</p>
            <p className="mt-2 text-sm font-medium text-zinc-100">{selected.incoming.title}</p>
            <p className="mt-1 text-xs text-zinc-400 whitespace-pre-wrap">{selected.incoming.excerpt}</p>
          </div>
          {selected.continuity_note ? (
            <p className="md:col-span-2 text-[11px] text-amber-200/80">{selected.continuity_note}</p>
          ) : null}
          <div className="md:col-span-2 space-y-2">
            <label className="block text-[10px] text-zinc-500">
              Edit merge title
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-zinc-500">
              Edit merge excerpt
              <textarea
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                rows={4}
                value={editExcerpt}
                onChange={(e) => setEditExcerpt(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve("keep_base")}
                className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200"
              >
                Keep existing
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve("accept_incoming")}
                className="rounded bg-sky-900/80 px-3 py-1.5 text-xs text-sky-100"
              >
                Accept incoming
              </button>
              <button
                type="button"
                disabled={busy || editExcerpt.trim().length < 20}
                onClick={() => void resolve("edit_merge")}
                className="rounded bg-emerald-900/80 px-3 py-1.5 text-xs text-emerald-100"
              >
                Save edited merge
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve("dismiss")}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
