import { useEffect, useState } from "react";

import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { WikiAuthorView } from "../components/WikiAuthorView";
import { WikiDraftProvider } from "../context/WikiDraftContext";
import { useNarrative } from "../context/NarrativeContext";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

export default function WikiPage() {
  const { selection } = useNarrative();
  const [fanPreview, setFanPreview] = useState(false);
  const [wikiEditable, setWikiEditable] = useState(true);
  const [wikiLockedAt, setWikiLockedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setFanPreview(false);
    setWikiEditable(true);
    setStatus(null);
  }, [selection?.manuscriptId]);

  useEffect(() => {
    if (!selection?.manuscriptId) return;
    void (async () => {
      try {
        const token = await getPreferredBffBearer();
        const res = await fetch(bffUrl("/api/manuscripts"), {
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token) },
        });
        const json = (await res.json()) as {
          manuscripts?: { id: string; wiki_revision_locked_at?: string | null }[];
        };
        const row = json.manuscripts?.find((m) => m.id === selection.manuscriptId);
        setWikiLockedAt(row?.wiki_revision_locked_at ?? null);
      } catch {
        setWikiLockedAt(null);
      }
    })();
  }, [selection?.manuscriptId]);

  const canEdit = Boolean(selection && !fanPreview && !wikiLockedAt);

  return (
    <CreativeManuscriptShell>
      {wikiLockedAt ? (
        <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
          Wiki is locked at finished revisions ({new Date(wikiLockedAt).toLocaleString()}). To edit earlier
          wiki state, email support with admin verification and your reason for the change.
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-[Georgia,serif] text-3xl font-bold tracking-tight text-zinc-50">
            Lore Wiki
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Encyclopedia for{" "}
            <span className="font-medium text-zinc-200">
              {selection?.title?.trim() || "this manuscript"}
            </span>
            . Browse the overview for characters, settings, and world traits — hover links for
            quick lore cards, or open full articles from the sidebar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFanPreview((v) => !v);
              if (!fanPreview) setWikiEditable(false);
            }}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              fanPreview
                ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500",
            ].join(" ")}
            aria-pressed={fanPreview}
          >
            {fanPreview ? "Fan preview on" : "Fan preview (hide spoilers)"}
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setWikiEditable((v) => !v)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                wikiEditable
                  ? "border-violet-500/60 bg-violet-600/90 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500",
              ].join(" ")}
              aria-pressed={wikiEditable}
            >
              <span aria-hidden>✎</span>
              {wikiEditable ? "Editing wiki" : "Edit wiki"}
            </button>
          ) : null}
        </div>
      </header>

      {status ? (
        <p className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200/90">
          {status}
        </p>
      ) : null}

      {selection ? (
        <WikiDraftProvider key={selection.manuscriptId} manuscriptId={selection.manuscriptId}>
          <WikiAuthorView
            manuscriptId={selection.manuscriptId}
            tenantId={selection.tenantId}
            fanPreview={fanPreview}
            wikiEditable={wikiEditable && !wikiLockedAt}
            onStatus={setStatus}
          />
        </WikiDraftProvider>
      ) : null}
    </CreativeManuscriptShell>
  );
}
