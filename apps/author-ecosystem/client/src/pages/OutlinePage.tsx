import { useEffect, useMemo, useState } from "react";

import { OutlineGoogleDocPicker } from "../components/OutlineGoogleDocPicker";
import { PlanningCommandCenter } from "../components/PlanningCommandCenter";
import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { useNarrative } from "../context/NarrativeContext";
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

export default function OutlinePage() {
  const { selection } = useNarrative();
  const [tab, setTab] = useState<OutlineTabId>("building-block-outline");
  const [notes, setNotes] = useState("");
  const [blankOutline, setBlankOutline] = useState("");
  const [savingBlank, setSavingBlank] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const notesStorageKey = useMemo(
    () => (selection ? `elphie:outline:notes:${selection.manuscriptId}` : null),
    [selection]
  );

  useEffect(() => {
    if (!selection || !notesStorageKey) return;
    try {
      setNotes(localStorage.getItem(notesStorageKey) ?? "");
    } catch {
      setNotes("");
    }
  }, [selection, notesStorageKey]);

  useEffect(() => {
    if (!selection) return;
    void (async () => {
      try {
        const token = await getPreferredBffBearer();
        const res = await fetch(bffUrl("/api/manuscripts"), {
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token) },
        });
        const json = (await res.json().catch(() => ({}))) as {
          manuscripts?: Array<{ id: string; outline?: string | null }>;
        };
        const row = json.manuscripts?.find((m) => m.id === selection.manuscriptId);
        setBlankOutline(row?.outline ?? "");
      } catch {
        setBlankOutline("");
      }
    })();
  }, [selection]);

  const saveBlankOutline = async () => {
    if (!selection) return;
    setSavingBlank(true);
    setStatus(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl(`/api/manuscripts/${encodeURIComponent(selection.manuscriptId)}`), {
        method: "PATCH",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outline: blankOutline }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setStatus("Blank outline saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBlank(false);
    }
  };

  const syncNotesToOutline = async () => {
    if (!selection) return;
    setSavingNotes(true);
    setStatus(null);
    try {
      if (notesStorageKey) {
        localStorage.setItem(notesStorageKey, notes);
      }
      const token = await getPreferredBffBearer();
      const res = await fetch(
        bffUrl(`/api/manuscripts/${encodeURIComponent(selection.manuscriptId)}/sync-session`),
        {
          method: "POST",
          ...bffCredentials,
          headers: {
            ...bffAuthHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wikiNotes: notes,
            interviewTurns: [],
            plotBeats: [],
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setStatus("Notes synced to outline/wiki session.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      <CreativePageHeader
        title="Outline"
        description="Multi-mode outlining workspace for"
      />
      {selection ? (
        <CreativeManuscriptShell>
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
              <PlanningCommandCenter
                manuscriptId={selection.manuscriptId}
                tenantId={selection.tenantId}
                initialTab="sandbox"
                allowedTabs={["sandbox"]}
                compactChrome
              />
            ) : null}

            {tab === "interview-style-outline" ? (
              <PlanningCommandCenter
                manuscriptId={selection.manuscriptId}
                tenantId={selection.tenantId}
                initialTab="interview"
                allowedTabs={["interview"]}
                compactChrome
              />
            ) : null}

            {tab === "wiki-outline" ? (
              <PlanningCommandCenter
                manuscriptId={selection.manuscriptId}
                tenantId={selection.tenantId}
                initialTab="wiki"
                allowedTabs={["wiki"]}
                compactChrome
              />
            ) : null}

            {tab === "notes-brainstorming" ? (
              <section className="space-y-3">
                <p className="text-xs text-zinc-500">
                  Freeform notes for brainstorms. Save locally and sync into the planning wiki/outline session.
                </p>
                <textarea
                  rows={12}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  placeholder="Dump ideas, chapter bullets, fragments, and alternate paths here..."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (notesStorageKey) localStorage.setItem(notesStorageKey, notes);
                      setStatus("Notes saved locally.");
                    }}
                    className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
                  >
                    Save notes locally
                  </button>
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={() => void syncNotesToOutline()}
                    className="rounded-full border border-violet-500/50 bg-violet-700/80 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingNotes ? "Syncing…" : "Sync notes to outline/wiki"}
                  </button>
                </div>
              </section>
            ) : null}

            {tab === "blank-page-outlining" ? (
              <section className="space-y-3">
                <p className="text-xs text-zinc-500">
                  Blank page outline editor writing directly to manuscript outline text.
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
              manuscriptId={selection.manuscriptId}
              onOutlineImported={(outline) => {
                setBlankOutline(outline);
                setTab("blank-page-outlining");
                setStatus("Outline imported from Google Doc. Review on Blank page tab.");
              }}
              onLinked={() => setStatus("Google Doc linked for HAL on this manuscript.")}
            />
            <PlanningCommandCenter
              manuscriptId={selection.manuscriptId}
              tenantId={selection.tenantId}
              initialTab="discovery"
              allowedTabs={["discovery"]}
              compactChrome
            />
          </section>
        </CreativeManuscriptShell>
      ) : null}
    </div>
  );
}
