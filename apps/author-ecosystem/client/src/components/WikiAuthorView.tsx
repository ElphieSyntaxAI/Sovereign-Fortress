import { useCallback, useEffect, useState } from "react";

import { PlanningCommandCenter } from "./PlanningCommandCenter";
import { WikiLoreRail } from "./WikiLoreRail";
import { WikiLoreSheet } from "./WikiLoreSheet";
import { WikiScrappedPanel } from "./WikiScrappedPanel";
import { WikiUnsavedDraftsList } from "./WikiUnsavedDraftsList";
import { useWikiDrafts } from "../context/WikiDraftContext";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import type { OutlineLoreKind } from "../lib/outlineLoreKinds";
import { getOutlineLoreKindConfig } from "../lib/outlineLoreKinds";
import type { WikiSheetDraft } from "../lib/wikiDraftStore";
import { parseFormStateFromMetadata } from "../lib/wikiEntityForms";
import {
  DOCUMENT_INGEST_COMMITTED_EVENT,
  type DocumentIngestCommittedDetail,
} from "../lib/documentIngestEvents";

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

function excerptFromWikiContent(content: string): string {
  const lines = content.split("\n");
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) bodyStart = i + 1;
    if (lines[i].trim() === "" && bodyStart > 0) {
      bodyStart = i + 1;
      break;
    }
  }
  const body = lines.slice(bodyStart).filter((l) => !l.startsWith("**chunk_type:") && !l.startsWith("**tags:")).join("\n").trim();
  return body || content;
}

function chunkTitle(c: WikiChunk): string {
  const meta = c.metadata;
  const t = meta.proposed_chunk_title;
  if (typeof t === "string" && t.trim()) return t.trim();
  const m = c.content.match(/^##\s+(.+)$/m);
  return m?.[1]?.trim() || c.source_document || "Untitled";
}

function chunkEntityLabel(meta: Record<string, unknown>): string | null {
  const kind = String(meta.outline_entity_kind ?? meta.lore_extraction_chunk_type ?? "");
  if (!kind) return null;
  try {
    return getOutlineLoreKindConfig(kind as OutlineLoreKind).label;
  } catch {
    return kind;
  }
}

export function WikiAuthorView(props: {
  manuscriptId: string;
  tenantId: string;
  fanPreview: boolean;
  wikiEditable: boolean;
  onStatus?: (message: string) => void;
}) {
  const { getDraft } = useWikiDrafts();
  const [data, setData] = useState<WikiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKind, setOpenKind] = useState<OutlineLoreKind | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [editChunkId, setEditChunkId] = useState<string | null>(null);
  const [sheetSeed, setSheetSeed] = useState<WikiSheetDraft | undefined>();

  const showEditChrome = props.wikiEditable && !props.fanPreview;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const qs = props.fanPreview ? "fan_preview" : "author";
      const res = await fetch(
        bffUrl(`/api/wiki/${encodeURIComponent(props.manuscriptId)}/chunks?view=${qs}`),
        { ...bffCredentials, headers: { ...bffAuthHeaders(token) } }
      );
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

  useEffect(() => {
    const onIngest = (ev: Event) => {
      const detail = (ev as CustomEvent<DocumentIngestCommittedDetail>).detail;
      if (detail?.manuscriptId === props.manuscriptId) void load();
    };
    window.addEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
    return () => window.removeEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
  }, [props.manuscriptId, load]);

  const openSheet = (
    kind: OutlineLoreKind,
    opts?: { draftId?: string; chunkId?: string; initial?: WikiSheetDraft }
  ) => {
    setOpenKind(kind);
    setEditDraftId(opts?.draftId ?? null);
    setEditChunkId(opts?.chunkId ?? null);
    setSheetSeed(opts?.initial);
  };

  const closeSheet = () => {
    setOpenKind(null);
    setEditDraftId(null);
    setEditChunkId(null);
    setSheetSeed(undefined);
  };

  const activeDraft = (editDraftId ? getDraft(editDraftId) : undefined) ?? sheetSeed;

  return (
    <div className={showEditChrome ? "pb-24 lg:pb-0 lg:pr-[5.5rem]" : ""}>
      {showEditChrome ? (
        <>
          <WikiLoreRail
            openKind={openKind}
            onOpenKind={(kind) => openSheet(kind)}
          />
          {openKind ? (
            <WikiLoreSheet
              kind={openKind}
              manuscriptId={props.manuscriptId}
              tenantId={props.tenantId}
              draftId={editDraftId ?? undefined}
              chunkId={editChunkId}
              initial={activeDraft}
              onClose={closeSheet}
              onCommitted={props.onStatus}
              onReloadWiki={() => void load()}
            />
          ) : null}
        </>
      ) : null}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-400">
            {props.fanPreview ? (
              <>
                <span className="font-medium text-amber-200">Fan preview</span> — canon / low-spoiler only (
                {data?.stats.shown ?? 0} shown).
              </>
            ) : (
              <>
                <span className="font-medium text-violet-200">Live wiki</span> — manuscript-scoped entries (
                {data?.stats.shown ?? 0}).
                {showEditChrome ? (
                  <span className="text-violet-300/80"> Use the rail to add lore while editing.</span>
                ) : null}
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

        {showEditChrome ? (
          <>
            <WikiUnsavedDraftsList
              onOpenDraft={(kind, draftId) => openSheet(kind, { draftId })}
            />
            <WikiScrappedPanel
              manuscriptId={props.manuscriptId}
              onStatus={props.onStatus}
              onReloadWiki={() => void load()}
            />
          </>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading wiki…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(data?.chunks ?? []).map((c) => {
              const meta = c.metadata;
              const entity = chunkEntityLabel(meta);
              const wikiTag =
                String(meta.ledger ?? "") === "wiki_snapshot"
                  ? ` · ${String(meta.wiki_visibility ?? "draft")}`
                  : "";
              const spoiler = meta.spoiler_level ? ` · spoiler:${String(meta.spoiler_level)}` : "";
              const canEditEntry =
                meta.wiki_author_entry === true || String(meta.ledger ?? "") === "wiki_snapshot";
              return (
                <article
                  key={c.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        {entity ?? c.chunk_type}
                        {wikiTag}
                        {spoiler}
                        {meta.wiki_form_tier ? (
                          <span className="text-zinc-600"> · {String(meta.wiki_form_tier)} form</span>
                        ) : null}
                      </p>
                      <h3 className="text-sm font-medium text-zinc-100">{chunkTitle(c)}</h3>
                    </div>
                    {showEditChrome && canEditEntry ? (
                      <button
                        type="button"
                        onClick={() => {
                          const kindRaw = String(
                            meta.outline_entity_kind ?? meta.lore_extraction_chunk_type ?? "character"
                          ) as OutlineLoreKind;
                          let kind: OutlineLoreKind = "character";
                          try {
                            getOutlineLoreKindConfig(kindRaw);
                            kind = kindRaw;
                          } catch {
                            /* fallback */
                          }
                          const draftId = crypto.randomUUID();
                          const parsedForm = parseFormStateFromMetadata(meta);
                          openSheet(kind, {
                            chunkId: c.id,
                            draftId,
                            initial: {
                              draftId,
                              kind,
                              title: chunkTitle(c),
                              formTier: parsedForm?.tier ?? "blank",
                              formAnswers: parsedForm?.answers ?? {
                                freeform: excerptFromWikiContent(c.content),
                              },
                              plotPoint: String(meta.plot_point ?? "not_applicable"),
                              spoilerLevel: String(meta.spoiler_level ?? "high"),
                              genres: "",
                              chunkId: c.id,
                              savedAt: Date.now(),
                            },
                          });
                        }}
                        className="rounded-full border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300"
                      >
                        Edit sheet
                      </button>
                    ) : null}
                  </header>
                  <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {c.content}
                  </p>
                </article>
              );
            })}
            {(data?.chunks.length ?? 0) === 0 ? (
              <p className="text-sm text-zinc-500 lg:col-span-2">
                {showEditChrome
                  ? "No committed wiki entries yet — use the edit rail to add character, setting, plot point, and more."
                  : "No lore chunks for this manuscript yet."}
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
    </div>
  );
}
