import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { OutlineGoogleDocPicker } from "../components/OutlineGoogleDocPicker";
import {
  OutlinePlanningSessionChrome,
  PlanningCommandCenter,
} from "../components/PlanningCommandCenter";
import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { useNarrative } from "../context/NarrativeContext";
import {
  mergeNotesForLibrarianSync,
  PlanningSessionProvider,
  usePlanningSession,
} from "../planning/PlanningSessionContext";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

type OutlineTabId =
  | "building-block-outline"
  | "interview-style-outline"
  | "wiki-outline"
  | "notes-brainstorming"
  | "blank-page-outlining";

const TABS: { id: OutlineTabId; label: string }[] = [
  { id: "building-block-outline", label: "Building block outline" },
  { id: "interview-style-outline", label: "Interview style outline" },
  { id: "wiki-outline", label: "Wiki outline" },
  { id: "notes-brainstorming", label: "Notes/brainstorming" },
  { id: "blank-page-outlining", label: "Blank page outlining" },
];

const pccProps = {
  compactChrome: true,
  useParentSession: true as const,
};

export default function OutlinePage() {
  const { selection } = useNarrative();
  return (
    <div className="space-y-6">
      <CreativePageHeader title="Outline" description="Multi-mode outlining workspace for" />
      {selection ? (
        <PlanningSessionProvider manuscriptId={selection.manuscriptId}>
          <CreativeManuscriptShell>
            <OutlinePageContent
              manuscriptId={selection.manuscriptId}
              tenantId={selection.tenantId}
            />
          </CreativeManuscriptShell>
        </PlanningSessionProvider>
      ) : (
        <CreativeManuscriptShell>{null}</CreativeManuscriptShell>
      )}
    </div>
  );
}

function OutlinePageContent(props: { manuscriptId: string; tenantId: string }) {
  const [tab, setTab] = useState<OutlineTabId>("building-block-outline");
  const [blankOutline, setBlankOutline] = useState("");
  const [savingBlank, setSavingBlank] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const { brainstormNotes, setBrainstormNotes, wikiNotes, interviewTurns, plotBeats } =
    usePlanningSession();

  const loadManuscriptOutline = useCallback(async () => {
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/manuscripts"), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as {
        manuscripts?: Array<{ id: string; outline?: string | null }>;
      };
      const row = json.manuscripts?.find((m) => m.id === props.manuscriptId);
      setBlankOutline(row?.outline ?? "");
    } catch {
      setBlankOutline("");
    }
  }, [props.manuscriptId]);

  useEffect(() => {
    void loadManuscriptOutline();
  }, [loadManuscriptOutline]);

  const saveBlankOutline = async () => {
    setSavingBlank(true);
    setStatus(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(
        bffUrl(`/api/manuscripts/${encodeURIComponent(props.manuscriptId)}`),
        {
          method: "PATCH",
          ...bffCredentials,
          headers: {
            ...bffAuthHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ outline: blankOutline }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setStatus("Blank outline saved to manuscript.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBlank(false);
    }
  };

  const syncBrainstormViaSession = async () => {
    setStatus(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(
        bffUrl(`/api/manuscripts/${encodeURIComponent(props.manuscriptId)}/sync-session`),
        {
          method: "POST",
          ...bffCredentials,
          headers: {
            ...bffAuthHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wikiNotes: mergeNotesForLibrarianSync(wikiNotes, brainstormNotes),
            interviewTurns,
            plotBeats,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        warnings?: string[];
      };
      if (!res.ok) throw new Error(json.error || res.statusText);
      if (json.success === false) {
        setStatus(json.warnings?.join(" ") || "Sync returned no writes — add more content first.");
        return;
      }
      setStatus("Full outline session synced (notes, interview, beats, wiki scratch).");
      await loadManuscriptOutline();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const sharedPcc = {
    manuscriptId: props.manuscriptId,
    tenantId: props.tenantId,
    ...pccProps,
  };

  return (
    <>
        <OutlinePlanningSessionChrome
          manuscriptId={props.manuscriptId}
          tenantId={props.tenantId}
          onSynced={() => {
            setStatus("Planning session synced to Librarian. Blank outline refreshed if beats updated it.");
            void loadManuscriptOutline();
          }}
        />

        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav className="flex flex-wrap gap-2" aria-label="Outline modes">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    tab === t.id
                      ? "border-violet-500/60 bg-violet-950/40 text-violet-100"
                      : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {status ? <p className="text-xs text-zinc-400">{status}</p> : null}

          {tab === "building-block-outline" ? (
            <PlanningCommandCenter {...sharedPcc} initialTab="sandbox" allowedTabs={["sandbox"]} />
          ) : null}

          {tab === "interview-style-outline" ? (
            <PlanningCommandCenter {...sharedPcc} initialTab="interview" allowedTabs={["interview"]} />
          ) : null}

          {tab === "wiki-outline" ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-violet-900/40 bg-violet-950/25 px-3 py-2 text-xs text-violet-100/90">
                <span className="font-medium text-violet-200">Wiki scratch</span> below is shared with
                other outline tabs. For structured lore (characters, settings, plot points, themes), open{" "}
                <Link to="/wiki" className="font-semibold text-violet-300 underline hover:text-violet-200">
                  Wiki
                </Link>{" "}
                and click <span className="font-medium">Edit wiki</span>.
              </p>
              <PlanningCommandCenter {...sharedPcc} initialTab="wiki" allowedTabs={["wiki"]} />
            </div>
          ) : null}

          {tab === "notes-brainstorming" ? (
            <section className="space-y-3">
              <p className="text-xs text-zinc-500">
                Brainstorm notes are part of the shared outline session. Use{" "}
                <span className="text-zinc-300">Sync to Librarian</span> above to push everything, or sync
                just this tab below (includes interview + sandbox beats too).
              </p>
              <textarea
                rows={12}
                value={brainstormNotes}
                onChange={(e) => setBrainstormNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="Dump ideas, chapter bullets, fragments, and alternate paths here..."
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("Brainstorm notes saved locally for this manuscript.")}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
                >
                  Saved locally (auto)
                </button>
                <button
                  type="button"
                  onClick={() => void syncBrainstormViaSession()}
                  className="rounded-full border border-violet-500/50 bg-violet-700/80 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Sync full session to Librarian
                </button>
              </div>
            </section>
          ) : null}

          {tab === "blank-page-outlining" ? (
            <section className="space-y-3">
              <p className="text-xs text-zinc-500">
                Manuscript outline text (<code className="text-zinc-400">p4_manuscripts.outline</code>
                ). Sandbox plot beats can also update this when you sync to Librarian.
              </p>
              <textarea
                rows={14}
                value={blankOutline}
                onChange={(e) => setBlankOutline(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="Write a full traditional outline here (acts, beats, chapter bullets)..."
              />
              <button
                type="button"
                disabled={savingBlank}
                onClick={() => void saveBlankOutline()}
                className="rounded-full border border-violet-500/50 bg-violet-700/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingBlank ? "Saving…" : "Save blank-page outline"}
              </button>
            </section>
          ) : null}
        </section>

        <section className="space-y-3 rounded-xl border border-amber-900/30 bg-amber-950/15 p-4">
          <h2 className="text-sm font-semibold text-amber-100">Connect completed outline docs</h2>
          <p className="text-xs text-amber-200/75">
            Pick a Google Doc from your Drive to import outline text and/or link it for HAL. You can also
            ingest DOCX/TXT/PDF below.
          </p>
          <OutlineGoogleDocPicker
            manuscriptId={props.manuscriptId}
            onOutlineImported={(outline) => {
              setBlankOutline(outline);
              setTab("blank-page-outlining");
              setStatus("Outline imported from Google Doc. Review on Blank page tab.");
            }}
            onLinked={() => setStatus("Google Doc linked for HAL on this manuscript.")}
          />
          <PlanningCommandCenter
            {...sharedPcc}
            initialTab="discovery"
            allowedTabs={["discovery"]}
          />
        </section>
    </>
  );
}
