import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { PlanningCommandCenter } from "./PlanningCommandCenter";
import { WikiLoreRail } from "./WikiLoreRail";
import { WikiLoreSheet } from "./WikiLoreSheet";
import { WikiScrappedPanel } from "./WikiScrappedPanel";
import { WikiFileImportCleanup } from "./WikiFileImportCleanup";
import { WikiUnsavedDraftsList } from "./WikiUnsavedDraftsList";
import { WikiArticlePage } from "./wiki/WikiArticlePage";
import { WikiManuscriptOverview } from "./wiki/WikiManuscriptOverview";
import { WikiSectionSidebar } from "./wiki/WikiSectionSidebar";
import { WikiSelectionAssignBar } from "./wiki/WikiSelectionAssignBar";
import { useAuthorRole } from "../context/AuthorRoleContext";
import { useWikiDrafts } from "../context/WikiDraftContext";
import { resolveAuthorDisplayName } from "../lib/wikiEntityCard";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import type { OutlineLoreKind } from "../lib/outlineLoreKinds";
import { getOutlineLoreKindConfig } from "../lib/outlineLoreKinds";
import {
  groupWikiChunksBySection,
  wikiChunkTitle,
  type WikiChunkLike,
} from "../lib/wikiArticleParse";
import type { WikiSheetDraft } from "../lib/wikiDraftStore";
import { parseFormStateFromMetadata } from "../lib/wikiEntityForms";
import { scrapWikiEntry } from "../lib/wikiEntryClient";
import {
  formAnswersForAssignKind,
  guessTitleFromExcerpt,
} from "../lib/wikiSelectionAssign";
import {
  DOCUMENT_INGEST_COMMITTED_EVENT,
  type DocumentIngestCommittedDetail,
} from "../lib/documentIngestEvents";

type WikiChunk = WikiChunkLike & {
  source_document: string;
  chunk_index: number;
};

type WikiPayload = {
  view: string;
  chunks: WikiChunk[];
  stats: {
    total: number;
    shown: number;
    hidden_spoilers: number;
    hidden_rag_shards?: number;
    import_cleanup_candidates?: number;
  };
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
  const body = lines
    .slice(bodyStart)
    .filter((l) => !l.startsWith("**chunk_type:") && !l.startsWith("**tags:"))
    .join("\n")
    .trim();
  return body || content;
}

export function WikiAuthorView(props: {
  manuscriptId: string;
  tenantId: string;
  fanPreview: boolean;
  wikiEditable: boolean;
  onStatus?: (message: string) => void;
}) {
  const { getDraft } = useWikiDrafts();
  const { user } = useAuthorRole();
  const [data, setData] = useState<WikiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(true);
  const [openKind, setOpenKind] = useState<OutlineLoreKind | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [editChunkId, setEditChunkId] = useState<string | null>(null);
  const [sheetSeed, setSheetSeed] = useState<WikiSheetDraft | undefined>();
  const [architectOpen, setArchitectOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  const showEditChrome = props.wikiEditable && !props.fanPreview;

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
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
      if (!soft) setData(null);
    } finally {
      setLoading(false);
    }
  }, [props.manuscriptId, props.fanPreview]);

  useEffect(() => {
    void load(false);
  }, [props.manuscriptId, props.fanPreview, load]);

  useEffect(() => {
    const onIngest = (ev: Event) => {
      const detail = (ev as CustomEvent<DocumentIngestCommittedDetail>).detail;
      if (detail?.manuscriptId === props.manuscriptId) void load(true);
    };
    window.addEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
    return () => window.removeEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
  }, [props.manuscriptId, load]);

  const navSections = useMemo(
    () => groupWikiChunksBySection(data?.chunks ?? []),
    [data?.chunks]
  );

  const selectedChunk = useMemo(() => {
    if (!selectedId) return null;
    return data?.chunks.find((c) => c.id === selectedId) ?? null;
  }, [data?.chunks, selectedId]);

  const authorDisplayName = resolveAuthorDisplayName(user?.email);

  const selectArticle = (id: string) => {
    setSelectedId(id);
    setShowOverview(false);
  };

  const selectOverview = () => {
    setShowOverview(true);
  };

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

  const openEditForChunk = (c: WikiChunk) => {
    const meta = c.metadata;
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
        title: wikiChunkTitle(c),
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
  };

  const openAssignFromExcerpt = (kind: OutlineLoreKind, excerpt: string) => {
    const draftId = crypto.randomUUID();
    if (kind === "character" || kind === "setting" || kind === "environment") {
      openSheet(kind, {
        draftId,
        initial: {
          draftId,
          kind,
          title: guessTitleFromExcerpt(excerpt),
          formTier: "general",
          formAnswers: formAnswersForAssignKind(kind, excerpt),
          plotPoint: "not_applicable",
          spoilerLevel: "high",
          genres: "",
          chunkId: null,
          savedAt: Date.now(),
        },
      });
      props.onStatus?.(`Opened ${kind} sheet with your highlighted excerpt — review and save.`);
      return;
    }
    openSheet(kind, { draftId });
  };

  const removeChunk = async (c: WikiChunk) => {
    const label = wikiChunkTitle(c);
    if (
      !window.confirm(
        `Remove "${label}" from the live wiki?\n\nIt moves to Scrapped ideas — you can restore it later.`
      )
    ) {
      return;
    }
    setRemoveBusy(true);
    try {
      await scrapWikiEntry(props.manuscriptId, c.id);
      props.onStatus?.(`"${label}" moved to Scrapped ideas.`);
      if (selectedId === c.id) {
        setSelectedId(null);
        setShowOverview(true);
      }
      await load(true);
    } catch (e) {
      props.onStatus?.(e instanceof Error ? e.message : String(e));
    } finally {
      setRemoveBusy(false);
    }
  };

  const activeDraft = (editDraftId ? getDraft(editDraftId) : undefined) ?? sheetSeed;

  return (
    <div className={showEditChrome ? "pb-24 lg:pb-0 lg:pr-[5.5rem]" : ""}>
      {showEditChrome ? (
        <>
          <WikiLoreRail
            openKind={openKind}
            onOpenKind={(kind) => openSheet(kind)}
            onDropExcerpt={openAssignFromExcerpt}
          />
          <WikiSelectionAssignBar
            enabled={showEditChrome && !showOverview && Boolean(selectedChunk)}
            onAssign={openAssignFromExcerpt}
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
              onReloadWiki={() => void load(true)}
            />
          ) : null}
        </>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-300/30 shadow-lg dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-300/30 bg-zinc-200/80 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-zinc-600 dark:text-zinc-400">
            {props.fanPreview ? (
              <>
                <span className="font-semibold text-amber-700 dark:text-amber-300">Fan view</span> —{" "}
                {data?.stats.shown ?? 0} public articles
              </>
            ) : showEditChrome ? (
              <>
                <span className="font-semibold text-violet-700 dark:text-violet-300">Editing</span> — open
                an article, use <strong>Remove</strong> or the lore sheet to delete; highlight text to
                assign character / setting / environment
              </>
            ) : (
              <>
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Read mode</span> — turn on
                Edit wiki to change articles
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {showEditChrome ? (
          <div className="space-y-4 border-b border-zinc-300/20 bg-zinc-100/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <WikiFileImportCleanup
              manuscriptId={props.manuscriptId}
              count={data?.stats.import_cleanup_candidates ?? 0}
              onStatus={props.onStatus}
              onReloadWiki={() => void load(true)}
            />
            <WikiUnsavedDraftsList onOpenDraft={(kind, draftId) => openSheet(kind, { draftId })} />
            <WikiScrappedPanel
              manuscriptId={props.manuscriptId}
              onStatus={props.onStatus}
              onReloadWiki={() => void load(true)}
            />
          </div>
        ) : null}

        {loading && !data ? (
          <p className="p-8 text-sm text-zinc-500">Loading wiki…</p>
        ) : error && !data ? (
          <p className="p-8 text-sm text-red-400">{error}</p>
        ) : navSections.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-[Georgia,serif] text-xl text-zinc-700 dark:text-zinc-300">
              No structured lore articles yet
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-500">
              Your novel may already be in the <strong className="font-medium text-zinc-400">RAG index</strong>{" "}
              (500-word chunks for Librarian search) — that is not the same as wiki articles. Characters,
              settings, and environment cards are created when you{" "}
              <strong className="font-medium text-zinc-400">import a document on Manuscripts</strong> and
              submit the review step, or when you add entries with the + rail.
            </p>
            {data?.stats.hidden_rag_shards ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                {data.stats.hidden_rag_shards} retrieval shard(s) indexed — hidden from this view on purpose.
              </p>
            ) : null}
            {showEditChrome ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/manuscripts#import-documents"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  Import document → build wiki blocks
                </Link>
                <p className="w-full text-xs text-zinc-500">
                  Or use Character / Setting / Environment on the right to add lore manually.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Turn on Edit wiki to add lore manually.</p>
            )}
          </div>
        ) : (
          <div className="grid min-h-[520px] lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
            <WikiSectionSidebar
              sections={navSections}
              selectedId={showOverview ? null : selectedId}
              overviewActive={showOverview}
              onSelectOverview={selectOverview}
              onSelect={selectArticle}
              manuscriptTitle={data?.manuscript.title}
            />
            <div className="min-w-0 bg-zinc-100 dark:bg-zinc-950/50">
              {showOverview ? (
                <WikiManuscriptOverview
                  manuscriptTitle={data?.manuscript.title}
                  authorName={authorDisplayName}
                  chunks={data?.chunks ?? []}
                  onOpenArticle={selectArticle}
                />
              ) : selectedChunk ? (
                <div>
                  <div className="border-b border-zinc-200 bg-white/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <button
                      type="button"
                      onClick={selectOverview}
                      className="text-sm font-medium text-amber-800 hover:underline dark:text-amber-300"
                    >
                      ← Back to overview
                    </button>
                  </div>
                  <WikiArticlePage
                    chunk={selectedChunk}
                    wikiEditable={showEditChrome}
                    onEdit={() => openEditForChunk(selectedChunk)}
                    onRemove={() => void removeChunk(selectedChunk)}
                    removeBusy={removeBusy}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {!props.fanPreview ? (
        <details
          className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/40"
          open={architectOpen}
          onToggle={(e) => setArchitectOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-300">
            Wiki Architect & scratch notes
          </summary>
          <div className="border-t border-zinc-800 p-4">
            {architectOpen ? (
              <PlanningCommandCenter
                manuscriptId={props.manuscriptId}
                tenantId={props.tenantId}
                initialTab="wiki"
                allowedTabs={["wiki"]}
                compactChrome
                wikiReadOnly={!props.wikiEditable}
                hideRagDashboard
              />
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
