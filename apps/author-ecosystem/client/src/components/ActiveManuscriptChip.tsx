import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { SwitchProjectDialog } from "./SwitchProjectDialog";
import { useNarrative } from "../context/NarrativeContext";
import { useActivateManuscript } from "../hooks/useActivateManuscript";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import {
  displayTitle,
  hubPayloadToProjectGroups,
  hubRowToSelection,
  type HubManuscript,
  type HubProjectGroup,
  type ManuscriptHubPayload,
} from "../lib/manuscriptTypes";

export function ActiveManuscriptChip() {
  const { selection } = useNarrative();
  const activate = useActivateManuscript();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<HubProjectGroup[]>([]);
  const [pendingSwitch, setPendingSwitch] = useState<HubManuscript | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/manuscripts/hub"), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as ManuscriptHubPayload & {
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setGroups(hubPayloadToProjectGroups(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadHub();
  }, [open, loadHub]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onPickBook = (row: HubManuscript) => {
    if (selection?.manuscriptId === row.id) {
      setOpen(false);
      return;
    }
    if (!selection) {
      void activate(hubRowToSelection(row));
      setOpen(false);
      return;
    }
    setPendingSwitch(row);
    setOpen(false);
  };

  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    const seriesTitle =
      groups.find((g) => g.books.some((b) => b.id === pendingSwitch.id))?.seriesTitle ?? null;
    void activate({
      ...hubRowToSelection(pendingSwitch),
      seriesTitle,
    });
    setPendingSwitch(null);
  };

  if (!selection) {
    return (
      <Link
        to="/manuscripts"
        className="hidden max-w-[14rem] truncate rounded-full border border-amber-700/40 bg-amber-950/30 px-2.5 py-1 text-[10px] text-amber-200/90 sm:inline-block"
      >
        No active project
      </Link>
    );
  }

  const label = selection.title?.trim() || selection.manuscriptId.slice(0, 8);

  return (
    <>
      <div className="relative hidden sm:block" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={selection.manuscriptId}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[10px] text-zinc-300 hover:border-zinc-500"
        >
          <span className="shrink-0 text-zinc-500">MS:</span>
          <span className="truncate">{label}</span>
          <span aria-hidden className="shrink-0 text-zinc-500">
            ▾
          </span>
        </button>

        {open ? (
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 max-h-[min(24rem,70vh)] w-[16rem] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
          >
            {loading ? (
              <p className="px-3 py-2 text-[10px] text-zinc-500">Loading projects…</p>
            ) : null}
            {error ? <p className="px-3 py-2 text-[10px] text-amber-300/90">{error}</p> : null}
            {!loading && !error && groups.length === 0 ? (
              <p className="px-3 py-2 text-[10px] text-zinc-500">No projects yet.</p>
            ) : null}

            {groups.map((group) => (
              <div key={group.seriesId ?? "standalone"} className="py-1">
                <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group.seriesTitle?.trim() || "Standalone"}
                </p>
                <ul>
                  {group.books.map((book) => {
                    const isActive = book.id === selection.manuscriptId;
                    return (
                      <li key={book.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          className={[
                            "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs",
                            isActive
                              ? "bg-violet-500/20 text-violet-100"
                              : "text-zinc-200 hover:bg-zinc-900",
                          ].join(" ")}
                          onClick={() => onPickBook(book)}
                        >
                          <span className="truncate">{displayTitle(book)}</span>
                          {isActive ? <span className="shrink-0">✓</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="mt-1 border-t border-zinc-800 pt-1">
              <Link
                to="/manuscripts"
                onClick={() => setOpen(false)}
                className="block px-3 py-1.5 text-[10px] text-violet-300/90 hover:bg-zinc-900 hover:text-violet-200"
              >
                Manage projects →
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <SwitchProjectDialog
        open={Boolean(pendingSwitch)}
        target={pendingSwitch}
        currentTitle={selection.title ?? null}
        onConfirm={confirmSwitch}
        onCancel={() => setPendingSwitch(null)}
      />
    </>
  );
}
