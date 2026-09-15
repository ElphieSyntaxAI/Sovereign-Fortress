import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { ContentSignal, IngestConflict, ProposedWiki } from "../../lib/onboardingApi";

type OutlineBeat = {
  synopsis: string;
  order: number;
  title?: string;
  pov_mode?: "single" | "split" | "unknown";
  pov_names?: string[];
};

type TabDiagnostics = {
  count: number;
  method?: string;
  sections?: Array<{ title: string; path?: string; layer: string }>;
};

type PairingDiagnostic = {
  section_path: string;
  heading: string;
  outline_entity_kind: string;
  source_type: string;
  plot_engine_panel: string;
  ledger: string;
};

const PANEL_LABELS: Record<string, string> = {
  character: "Character",
  settings: "Settings",
  environmental: "Environmental",
  breadcrumbs: "Outline",
  theme: "Theme",
};

const LAYER_LABELS: Record<string, string> = {
  front_matter: "front matter",
  book_synopsis: "synopsis",
  macro_outline: "macro outline",
  chapter_breakdown: "chapter breakdown",
  scene_grid: "scenes",
  character_bible: "characters",
  world_bible: "world",
  notes: "sequel / spin-off",
  unknown: "section",
};

type ParseCoverage = {
  source_chars?: number;
  llm_chars_processed?: number;
  llm_chunks?: number;
  rag_sections?: number;
  domains?: string[];
  capped?: boolean;
};

export function WikiIngestReviewModal(props: {
  open: boolean;
  slotLabel: string;
  proposed: ProposedWiki[];
  outlineBeats?: OutlineBeat[];
  outlineBeatCount?: number;
  tabDiagnostics?: TabDiagnostics | null;
  pairingDiagnostics?: PairingDiagnostic[];
  parseCoverage?: ParseCoverage | null;
  contentSignals?: ContentSignal[];
  ingestConflicts?: IngestConflict[];
  onEdit: (next: ProposedWiki[]) => void;
  onEditBeat?: (index: number, beat: OutlineBeat) => void;
  onRemoveWiki?: (index: number) => void;
  onRemoveBeat?: (index: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReject?: (reason: string) => void;
  onSubmitAnyway?: () => void;
  busy: boolean;
  error?: string | null;
  showSubmitAnyway?: boolean;
}) {
  const [local, setLocal] = useState(props.proposed);
  const [localBeats, setLocalBeats] = useState(props.outlineBeats ?? []);

  useEffect(() => {
    if (props.open) {
      setLocal(props.proposed);
      setLocalBeats(props.outlineBeats ?? []);
    }
  }, [props.open, props.proposed, props.outlineBeats]);

  if (!props.open) return null;

  const sync = (next: ProposedWiki[]) => {
    setLocal(next);
    props.onEdit(next);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/92 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-emerald-600/40 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-emerald-100">Wiki preview — {props.slotLabel}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Mapped from document content (not filename). Submitting writes live wiki entries and refreshes the Lore
          Librarian index, Plot Sandbox beats, and the manuscript outline. Edit, then submit.
        </p>
        {props.parseCoverage ? (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-[11px] text-zinc-400">
            <p className="font-semibold text-zinc-300">Parse coverage</p>
            <ul className="mt-1 space-y-0.5">
              {props.parseCoverage.source_chars != null ? (
                <li>
                  Source: {props.parseCoverage.source_chars.toLocaleString()} chars
                  {props.parseCoverage.llm_chars_processed != null &&
                  props.parseCoverage.llm_chars_processed < props.parseCoverage.source_chars
                    ? ` · LLM read ${props.parseCoverage.llm_chars_processed.toLocaleString()} in ${props.parseCoverage.llm_chunks ?? 1} chunk(s)`
                    : null}
                </li>
              ) : null}
              {props.parseCoverage.rag_sections != null ? (
                <li>RAG sections: {props.parseCoverage.rag_sections}</li>
              ) : null}
              {props.parseCoverage.domains && props.parseCoverage.domains.length > 0 ? (
                <li>Domains: {props.parseCoverage.domains.join(", ")}</li>
              ) : (
                <li className="text-amber-300/80">
                  No species/history/technology domains detected — add section headers (TECHNOLOGY, Species, Timeline) or RAG TAG lines.
                </li>
              )}
              {props.proposed.some(
                (r) =>
                  Array.isArray(r.wiki_metadata?.secondary_domains) ||
                  Array.isArray(r.wiki_metadata?.related_to) ||
                  r.wiki_metadata?.provenance != null
              ) ? (
                <li>
                  Cross-domain / Ref:{" "}
                  {
                    props.proposed.filter(
                      (r) =>
                        Array.isArray(r.wiki_metadata?.secondary_domains) ||
                        Array.isArray(r.wiki_metadata?.related_to) ||
                        r.wiki_metadata?.provenance != null
                    ).length
                  }{" "}
                  card(s) with Domains, Link, or provenance Ref
                </li>
              ) : null}
              {props.parseCoverage.capped ? (
                <li className="text-amber-300/80">Preview capped — canon sections kept first.</li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {props.error ? (
          <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {props.error}
          </p>
        ) : null}
        {props.showSubmitAnyway ? (
          <p className="mt-2 text-xs text-amber-300/90">
            Structure review flagged this mapping. You can fix entries above or submit anyway if the preview looks
            correct.
          </p>
        ) : null}
        {props.contentSignals && props.contentSignals.length > 0 ? (
          <p className="mt-2 text-[11px] text-violet-300/80">
            Structure: {props.contentSignals.map((s) => s.kind.replace(/_/g, " ")).join(", ")}
          </p>
        ) : null}
        {props.ingestConflicts?.filter((c) => c.severity === "warning").map((c) => (
          <p key={c.code} className="mt-1 text-[11px] text-amber-300/80">
            ⚠ {c.message}
          </p>
        ))}
        {props.tabDiagnostics && props.tabDiagnostics.count > 0 ? (
          <div className="mt-4 rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
            <p className="text-xs font-semibold text-sky-200">
              Google Doc tabs read ({props.tabDiagnostics.count}
              {props.tabDiagnostics.method ? ` · ${props.tabDiagnostics.method}` : ""})
            </p>
            {props.tabDiagnostics.sections && props.tabDiagnostics.sections.length > 0 ? (
              <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[11px] text-zinc-400">
                {props.tabDiagnostics.sections.map((s, i) => (
                  <li key={i}>
                    {s.path ? `${s.path} › ` : ""}
                    {s.title}
                    <span className="text-zinc-600">
                      {" "}
                      — {LAYER_LABELS[s.layer] ?? s.layer.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {props.pairingDiagnostics && props.pairingDiagnostics.length > 0 ? (
          <div className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
            <p className="text-xs font-semibold text-emerald-200">
              RAG section pairing ({props.pairingDiagnostics.length})
            </p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-[11px] text-zinc-400">
              {props.pairingDiagnostics.slice(0, 24).map((d, i) => (
                <li key={i}>
                  <span className="text-emerald-200/90">{d.heading}</span>
                  <span className="text-zinc-600">
                    {" "}
                    → {d.outline_entity_kind}
                    {PANEL_LABELS[d.plot_engine_panel]
                      ? ` · ${PANEL_LABELS[d.plot_engine_panel]} panel`
                      : ""}
                    {d.ledger !== "static" ? ` · ${d.ledger}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {props.outlineBeats && props.outlineBeats.length > 0 ? (
          <div className="mt-4 rounded-lg border border-violet-900/40 bg-violet-950/20 p-3">
            <p className="text-xs font-semibold text-violet-200">
              Outline / scene cards (
              {props.outlineBeatCount ?? localBeats.length})
            </p>
            <ol className="mt-2 max-h-56 list-decimal space-y-3 overflow-y-auto pl-4 text-xs text-zinc-400">
              {localBeats.map((b, i) => (
                <li key={i} className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-violet-100"
                      placeholder="Beat title"
                      value={b.title ?? ""}
                      disabled={props.busy}
                      onChange={(e) => {
                        const next = [...localBeats];
                        next[i] = { ...b, title: e.target.value };
                        setLocalBeats(next);
                        props.onEditBeat?.(i, next[i]!);
                      }}
                    />
                    {props.onRemoveBeat ? (
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-400/90 underline hover:text-red-300"
                        disabled={props.busy}
                        onClick={() => {
                          const next = localBeats.filter((_, j) => j !== i);
                          setLocalBeats(next);
                          props.onRemoveBeat?.(i);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    className="min-h-[56px] w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                    placeholder="Synopsis"
                    value={b.synopsis}
                    disabled={props.busy}
                    onChange={(e) => {
                      const next = [...localBeats];
                      next[i] = { ...b, synopsis: e.target.value };
                      setLocalBeats(next);
                      props.onEditBeat?.(i, next[i]!);
                    }}
                  />
                  {b.pov_mode === "split" ? (
                    <span className="text-[10px] text-amber-300/90">Split POV</span>
                  ) : b.pov_mode === "single" && b.pov_names?.[0] ? (
                    <span className="text-[10px] text-zinc-500">{b.pov_names[0]} POV</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {local.length === 0 && localBeats.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
            <p className="text-xs text-amber-200/90">
              No wiki rows or outline beats were extracted from this document. Add lore manually below, pick a
              different import slot (world bible vs draft), or upload a section with clearer headings.
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-emerald-300 underline hover:text-emerald-200"
              disabled={props.busy}
              onClick={() =>
                sync([
                  ...local,
                  {
                    title: "New lore entry",
                    excerpt: "",
                    chunk_type: "other",
                  },
                ])
              }
            >
              Add lore row
            </button>
          </div>
        ) : null}
        {local.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {local.map((entry, idx) => (
            <li key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-2 flex items-center justify-end">
                {props.onRemoveWiki ? (
                  <button
                    type="button"
                    className="text-[10px] text-red-400/90 underline hover:text-red-300"
                    disabled={props.busy}
                    onClick={() => sync(local.filter((_, i) => i !== idx))}
                  >
                    Remove entry
                  </button>
                ) : null}
              </div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm font-medium text-zinc-100"
                value={entry.title}
                onChange={(e) => {
                  const next = [...local];
                  next[idx] = { ...entry, title: e.target.value };
                  sync(next);
                }}
              />
              <textarea
                className="mt-2 min-h-[80px] w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                value={entry.excerpt}
                onChange={(e) => {
                  const next = [...local];
                  next[idx] = { ...entry, excerpt: e.target.value };
                  sync(next);
                }}
              />
            </li>
          ))}
        </ul>
        ) : (
          <button
            type="button"
            className="mt-4 text-xs font-medium text-emerald-300 underline hover:text-emerald-200"
            disabled={props.busy}
            onClick={() =>
              sync([
                ...local,
                {
                  title: "New lore entry",
                  excerpt: "",
                  chunk_type: "other",
                },
              ])
            }
          >
            Add another lore row
          </button>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Link
            to="/wiki"
            className="rounded-lg border border-violet-600/50 px-4 py-2 text-sm text-violet-200 hover:bg-violet-950/40"
          >
            Edit on Wiki
          </Link>
          <button
            type="button"
            className="rounded-lg border border-amber-700/50 px-4 py-2 text-sm text-amber-200/90 hover:bg-amber-950/40"
            disabled={props.busy}
            onClick={() => {
              const reason = window.prompt(
                "What went wrong with this mapping? (e.g. table rows merged into one entry)"
              );
              if (reason?.trim()) props.onReject?.(reason.trim());
            }}
          >
            Report bad mapping
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            disabled={props.busy}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          {props.showSubmitAnyway && props.onSubmitAnyway ? (
            <button
              type="button"
              className="rounded-lg border border-amber-600/60 bg-amber-950/50 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-40"
              disabled={props.busy}
              onClick={props.onSubmitAnyway}
            >
              {props.busy ? "Submitting…" : "Submit anyway"}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-40"
            disabled={
              props.busy ||
              (local.length === 0 && localBeats.length === 0)
            }
            onClick={props.onSubmit}
          >
            {props.busy ? "Submitting to wiki…" : "Submit to wiki & Lore Librarian"}
          </button>
        </div>
      </div>
    </div>
  );
}
