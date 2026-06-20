import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWikiDrafts } from "../context/WikiDraftContext";
import {
  getOutlineLoreKindConfig,
  PLOT_POINT_OPTIONS,
  SPOILER_LEVEL_OPTIONS,
  type OutlineLoreKind,
} from "../lib/outlineLoreKinds";
import {
  commitWikiEntry,
  scrapWikiEntry,
  updateWikiEntry,
  type WikiEntryPayload,
} from "../lib/wikiEntryClient";
import type { HumanEffortClient, WikiSheetDraft } from "../lib/wikiDraftStore";
import {
  composeWikiEntry,
  WIKI_FORM_TIER_OPTIONS,
  type WikiFormTier,
} from "../lib/wikiEntityForms";
import { WikiLoreFormFields } from "./WikiLoreFormFields";

const MIN_EXCERPT = 20;

function newEffortTracker(): HumanEffortClient {
  const now = new Date().toISOString();
  return {
    started_at: now,
    last_edit_at: now,
    title_chars: 0,
    body_chars: 0,
    edit_events: [],
    client: "author-wiki-sheet",
  };
}

function tierButtonClass(active: boolean): string {
  return [
    "rounded-lg border px-2 py-2 text-left text-xs transition",
    active
      ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600",
  ].join(" ");
}

export function WikiLoreSheet(props: {
  kind: OutlineLoreKind;
  manuscriptId: string;
  tenantId: string;
  draftId?: string;
  chunkId?: string | null;
  initial?: Partial<WikiSheetDraft>;
  onClose: () => void;
  onCommitted?: (message: string) => void;
  onReloadWiki?: () => void;
}) {
  const config = useMemo(() => getOutlineLoreKindConfig(props.kind), [props.kind]);
  const { upsertDraft, removeDraft, clearAllDrafts } = useWikiDrafts();

  const draftIdRef = useRef(props.draftId ?? crypto.randomUUID());
  const effortRef = useRef<HumanEffortClient>(newEffortTracker());

  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [formTier, setFormTier] = useState<WikiFormTier>(props.initial?.formTier ?? "general");
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>(
    props.initial?.formAnswers ??
      (props.initial?.details ? { freeform: props.initial.details } : {})
  );
  const [plotPoint, setPlotPoint] = useState(props.initial?.plotPoint ?? "not_applicable");
  const [spoilerLevel, setSpoilerLevel] = useState(props.initial?.spoilerLevel ?? "high");
  const [genres, setGenres] = useState(props.initial?.genres ?? "");
  const [chunkId, setChunkId] = useState<string | null>(props.chunkId ?? props.initial?.chunkId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const trackEdit = useCallback((field: string, value: string) => {
    const e = effortRef.current;
    e.last_edit_at = new Date().toISOString();
    if (field === "title") e.title_chars = value.length;
    else e.body_chars = Object.values(formAnswers).join("").length + value.length;
    e.edit_events.push({ at: e.last_edit_at, field, chars: value.length });
    if (e.edit_events.length > 120) e.edit_events = e.edit_events.slice(-120);
  }, [formAnswers]);

  const composed = useMemo(
    () =>
      composeWikiEntry({
        kind: props.kind,
        tier: formTier,
        title,
        answers: formAnswers,
        plotPoint,
        spoilerLevel,
        genres,
      }),
    [props.kind, formTier, title, formAnswers, plotPoint, spoilerLevel, genres]
  );

  const buildTags = (): string[] => {
    const tags = [...composed.tags];
    if (props.kind === "genre") {
      genres
        .split(/[,;]+/)
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => {
          const token = g.toLowerCase().replace(/\s+/g, "_");
          if (!tags.includes(token)) tags.push(token);
          const prefixed = `genre:${token}`;
          if (!tags.includes(prefixed)) tags.push(prefixed);
        });
    }
    return [...new Set([...config.defaultTags, ...tags])];
  };

  const buildPayload = (): WikiEntryPayload => ({
    title: title.trim(),
    excerpt: composed.excerpt,
    chunk_type: config.chunk_type,
    tags: buildTags(),
    wiki_metadata: composed.wiki_metadata,
    human_effort: effortRef.current,
  });

  const currentDraft = (): WikiSheetDraft => ({
    draftId: draftIdRef.current,
    kind: props.kind,
    title,
    formTier,
    formAnswers,
    plotPoint,
    spoilerLevel,
    genres,
    chunkId,
    savedAt: Date.now(),
  });

  useEffect(() => {
    if (!props.initial) return;
    setTitle(props.initial.title ?? "");
    setFormTier(props.initial.formTier ?? "general");
    setFormAnswers(
      props.initial.formAnswers ??
        (props.initial.details ? { freeform: props.initial.details } : {})
    );
    setPlotPoint(props.initial.plotPoint ?? "not_applicable");
    setSpoilerLevel(props.initial.spoilerLevel ?? "high");
    setGenres(props.initial.genres ?? "");
    setChunkId(props.chunkId ?? props.initial.chunkId ?? null);
  }, [props.initial, props.chunkId]);

  const setAnswer = (fieldId: string, value: string) => {
    setFormAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const hasContent = (): boolean => {
    if (title.trim()) return true;
    return Object.values(formAnswers).some((v) => String(v).trim().length > 0);
  };

  const saveAsDraft = () => {
    if (!hasContent()) {
      setError("Add a name or fill at least one field before saving a draft.");
      return;
    }
    upsertDraft(currentDraft());
    setError(null);
    setStatus("Draft saved in active memory (not on live wiki yet).");
  };

  const clearDraft = () => {
    removeDraft(draftIdRef.current);
    setTitle("");
    setFormAnswers({});
    setFormTier("general");
    setGenres("");
    setPlotPoint("not_applicable");
    setSpoilerLevel("high");
    setChunkId(null);
    effortRef.current = newEffortTracker();
    setError(null);
    setStatus("This sheet cleared.");
  };

  const clearAllUnsaved = () => {
    clearAllDrafts();
    clearDraft();
    setStatus("All unsaved wiki drafts cleared from memory.");
  };

  const commitToWiki = async () => {
    const name = title.trim();
    if (!name) {
      setError("Name / title is required.");
      return;
    }
    if (composed.excerpt.length < MIN_EXCERPT) {
      setError(`Fill enough fields to reach at least ${MIN_EXCERPT} characters before commit.`);
      return;
    }

    setBusy("commit");
    setError(null);
    setStatus(null);
    try {
      const payload = buildPayload();
      if (chunkId) {
        await updateWikiEntry(props.manuscriptId, chunkId, payload);
      } else {
        const result = await commitWikiEntry(props.manuscriptId, payload);
        const id = String((result.chunk as { id?: string } | undefined)?.id ?? "");
        if (id) setChunkId(id);
      }
      removeDraft(draftIdRef.current);
      props.onReloadWiki?.();
      props.onCommitted?.(`${config.label} committed to live wiki (${formTier} form).`);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const deleteEntry = async () => {
    if (!chunkId) {
      removeDraft(draftIdRef.current);
      props.onClose();
      return;
    }
    if (!window.confirm("Move this wiki entry to Scrapped ideas? You can restore it later.")) return;

    setBusy("delete");
    setError(null);
    try {
      await scrapWikiEntry(props.manuscriptId, chunkId, effortRef.current);
      removeDraft(draftIdRef.current);
      props.onReloadWiki?.();
      props.onCommitted?.(`${config.label} moved to Scrapped ideas.`);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wiki-lore-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <header className="shrink-0 border-b border-zinc-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="wiki-lore-sheet-title" className="text-base font-semibold text-zinc-100">
                {chunkId ? "Edit" : "Add"} {config.label.toLowerCase()}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">{config.description}</p>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {WIKI_FORM_TIER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setFormTier(opt.id);
                  setStatus(null);
                }}
                className={tierButtonClass(formTier === opt.id)}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] font-normal leading-snug text-zinc-500">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {props.kind === "setting" ? "Setting name" : props.kind === "character" ? "Character name" : "Title"}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                trackEdit("title", e.target.value);
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              placeholder={`${config.label} name…`}
              autoFocus
            />
          </label>

          {props.kind === "plot_point" ? (
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Plot beat (outline)
              </span>
              <select
                value={plotPoint}
                onChange={(e) => setPlotPoint(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              >
                {PLOT_POINT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {props.kind === "genre" ? (
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Genres (comma-separated)
              </span>
              <input
                type="text"
                value={genres}
                onChange={(e) => {
                  setGenres(e.target.value);
                  trackEdit("genres", e.target.value);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="Fantasy, romance, mystery…"
              />
            </label>
          ) : null}

          {props.kind === "spoiler" ? (
            <label className="block space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Spoiler level
              </span>
              <select
                value={spoilerLevel}
                onChange={(e) => setSpoilerLevel(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              >
                {SPOILER_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <WikiLoreFormFields
            kind={props.kind}
            tier={formTier}
            answers={formAnswers}
            onChange={setAnswer}
            onTrackEdit={trackEdit}
          />

          <p className="text-[10px] text-zinc-600">
            Preview length: {composed.excerpt.length} / {MIN_EXCERPT} min for commit · human-effort proof on save
          </p>

          {status ? <p className="text-xs text-emerald-300/90">{status}</p> : null}
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Sheet actions
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void commitToWiki()}
              className="rounded-full border border-violet-500/50 bg-violet-700/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy === "commit" ? "Committing…" : "Save (commit to wiki)"}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={saveAsDraft}
              className="rounded-full border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 disabled:opacity-50"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={clearDraft}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 disabled:opacity-50"
              title="Reset every field on this sheet without removing live wiki entries"
            >
              Clear this form
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={clearAllUnsaved}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 disabled:opacity-50"
              title="Discard all in-memory drafts across every lore type"
            >
              Clear all drafts
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void deleteEntry()}
              className="rounded-full border border-red-900/60 bg-red-950/50 px-3 py-1.5 text-xs font-medium text-red-200 disabled:opacity-50"
              title="Soft-delete: moves to Scrapped ideas (restorable)"
            >
              {busy === "delete" ? "Removing…" : "Remove from wiki"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
