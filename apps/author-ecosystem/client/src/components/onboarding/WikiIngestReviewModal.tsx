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

export function WikiIngestReviewModal(props: {
  open: boolean;
  slotLabel: string;
  proposed: ProposedWiki[];
  outlineBeats?: OutlineBeat[];
  outlineBeatCount?: number;
  tabDiagnostics?: TabDiagnostics | null;
  contentSignals?: ContentSignal[];
  ingestConflicts?: IngestConflict[];
  onEdit: (next: ProposedWiki[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onReject?: (reason: string) => void;
  busy: boolean;
}) {
  const [local, setLocal] = useState(props.proposed);

  useEffect(() => {
    if (props.open) setLocal(props.proposed);
  }, [props.open, props.proposed]);

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
          Mapped from document content (not filename). Wiki building blocks, scene/plot cards, and outline beats
          update the Wiki rail, Plot Sandbox, and manuscript outline. Edit, then submit.
        </p>
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
        {props.outlineBeats && props.outlineBeats.length > 0 ? (
          <div className="mt-4 rounded-lg border border-violet-900/40 bg-violet-950/20 p-3">
            <p className="text-xs font-semibold text-violet-200">
              Outline / scene cards (
              {props.outlineBeatCount ?? props.outlineBeats.length})
            </p>
            <ol className="mt-2 max-h-48 list-decimal space-y-1 overflow-y-auto pl-4 text-xs text-zinc-400">
              {props.outlineBeats.map((b, i) => {
                const label = b.title?.trim() || b.synopsis.split("\n")[0]?.trim() || b.synopsis;
                const detail = b.title ? b.synopsis : b.synopsis.slice(label.length).trim();
                const preview = detail.slice(0, 140) || label.slice(0, 160);
                return (
                  <li key={i}>
                    <span className="text-violet-200/90">{label.slice(0, 100)}</span>
                    {b.pov_mode === "split" ? (
                      <span className="ml-1 text-[10px] text-amber-300/90">(split POV)</span>
                    ) : b.pov_mode === "single" && b.pov_names?.[0] ? (
                      <span className="ml-1 text-[10px] text-zinc-500">({b.pov_names[0]} POV)</span>
                    ) : null}
                    {preview && preview !== label ? (
                      <span className="text-zinc-500"> — {preview}{preview.length >= 140 ? "…" : ""}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
        <ul className="mt-4 space-y-4">
          {local.map((entry, idx) => (
            <li key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
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
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-40"
            disabled={props.busy}
            onClick={props.onSubmit}
          >
            {props.busy ? "Updating wiki & RAG…" : "Submit to wiki & brain"}
          </button>
        </div>
      </div>
    </div>
  );
}
