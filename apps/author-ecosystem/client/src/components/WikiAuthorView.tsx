import { useCallback, useEffect, useState } from "react";

import { PlanningCommandCenter } from "./PlanningCommandCenter";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

type WikiChunk = {
  id: string;
  chunk_type: string;
  source_document: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
};

type WikiPayload = {
  view: string;
  chunks: WikiChunk[];
  stats: { total: number; shown: number; hidden_spoilers: number };
  manuscript: { title: string | null; outline: string | null };
};

export function WikiAuthorView(props: {
  manuscriptId: string;
  tenantId: string;
  fanPreview: boolean;
  wikiEditable: boolean;
}) {
  const [data, setData] = useState<WikiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const u = new URL(
        bffUrl(`/api/wiki/${encodeURIComponent(props.manuscriptId)}/chunks`),
        window.location.origin
      );
      u.searchParams.set("view", props.fanPreview ? "fan_preview" : "author");
      const res = await fetch(u.toString(), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as WikiPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.manuscriptId, props.fanPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <p className="text-xs text-zinc-400">
          {props.fanPreview ? (
            <>
              <span className="font-medium text-amber-200">Fan preview</span> — showing canon / low-spoiler
              lore only ({data?.stats.shown ?? 0} of {data?.stats.total ?? 0} chunks).
              {data && data.stats.hidden_spoilers > 0 ? (
                <span className="text-amber-300/80"> · {data.stats.hidden_spoilers} hidden as spoilers/drafts.</span>
              ) : null}
            </>
          ) : (
            <>
              <span className="font-medium text-violet-200">Full author view</span> — all ingested lore, drafts,
              and planning material ({data?.stats.shown ?? 0} chunks).
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto text-xs text-zinc-500 underline hover:text-zinc-300"
        >
          Refresh lore index
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading wiki…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(data?.chunks ?? []).map((c) => {
            const meta = c.metadata;
            const wikiTag =
              String(meta.ledger ?? "") === "wiki_snapshot"
                ? ` · wiki:${String(meta.wiki_visibility ?? "draft")}`
                : "";
            const spoiler = meta.spoiler_level ? ` · spoiler:${String(meta.spoiler_level)}` : "";
            return (
              <article
                key={c.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <header className="mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {c.chunk_type}
                    {wikiTag}
                    {spoiler}
                  </p>
                  <h3 className="text-sm font-medium text-zinc-100">
                    {c.source_document || "Untitled"} #{c.chunk_index + 1}
                  </h3>
                </header>
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {c.content}
                </p>
              </article>
            );
          })}
          {(data?.chunks.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500 lg:col-span-2">
              No lore chunks yet — sync from Outline or ingest planning material.
            </p>
          ) : null}
        </div>
      )}

      {data?.manuscript.outline?.trim() ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <h3 className="text-sm font-semibold text-zinc-200">Manuscript outline</h3>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-400">
            {data.manuscript.outline}
          </pre>
        </section>
      ) : null}

      {!props.fanPreview ? (
        <PlanningCommandCenter
          manuscriptId={props.manuscriptId}
          tenantId={props.tenantId}
          initialTab="wiki"
          allowedTabs={["wiki"]}
          compactChrome
          wikiReadOnly={!props.wikiEditable}
        />
      ) : null}
    </div>
  );
}
