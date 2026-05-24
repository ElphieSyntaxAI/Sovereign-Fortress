import { useEffect, useState } from "react";

import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { WikiAuthorView } from "../components/WikiAuthorView";
import { useNarrative } from "../context/NarrativeContext";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

export default function WikiPage() {
  const { selection } = useNarrative();
  const [fanPreview, setFanPreview] = useState(false);
  const [wikiEditable, setWikiEditable] = useState(false);
  const [wikiLockedAt, setWikiLockedAt] = useState<string | null>(null);

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
          <h1 className="text-2xl font-semibold tracking-tight">Wiki</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Full author lore index for{" "}
            <span className="text-zinc-200">{selection?.title?.trim() || "this manuscript"}</span>. Toggle fan
            preview to see what fans would access (spoilers and drafts hidden).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFanPreview((v) => !v)}
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
          {!fanPreview && !wikiLockedAt ? (
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
              {wikiEditable ? "Editing scratch" : "Edit scratch"}
            </button>
          ) : null}
        </div>
      </header>

      <WikiAuthorView
        manuscriptId={selection!.manuscriptId}
        tenantId={selection!.tenantId}
        fanPreview={fanPreview}
        wikiEditable={wikiEditable && !wikiLockedAt}
      />
    </CreativeManuscriptShell>
  );
}
