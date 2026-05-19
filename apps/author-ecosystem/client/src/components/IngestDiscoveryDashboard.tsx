import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useDropzone } from "react-dropzone";

import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { usePlanningSession } from "../planning/PlanningSessionContext";

export type IdentifiedLore = {
  characters: string[];
  locations: string[];
  objects: string[];
};

export type IdentifiedBeat = {
  summary: string;
  plot_point_order: number;
};

export type DiscoveryPayload = {
  identified_lore: IdentifiedLore;
  identified_beats: IdentifiedBeat[];
  conflicts: string[];
};

type IngestUploadJson = {
  success?: boolean;
  error?: string;
  message?: string;
  discovery?: unknown;
  original_filename?: string;
  content_digest?: string;
  window_count?: number;
  markdown_word_count?: number;
  window_errors?: Array<{ index: number; message: string }>;
};

export type IngestDiscoveryDashboardProps = {
  /** Sent as `project_id` on lore-git commit (same as manuscript / project scope). */
  projectId: string | null;
  getAccessToken: () => string | null | Promise<string | null>;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

function normalizeDiscovery(raw: unknown): DiscoveryPayload {
  const empty: DiscoveryPayload = {
    identified_lore: { characters: [], locations: [], objects: [] },
    identified_beats: [],
    conflicts: [],
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const o = raw as Record<string, unknown>;
  const lore = o["identified_lore"];
  if (lore && typeof lore === "object" && !Array.isArray(lore)) {
    const L = lore as Record<string, unknown>;
    const arr = (k: string) =>
      Array.isArray(L[k]) ? L[k].map((x) => String(x).trim()).filter(Boolean) : [];
    empty.identified_lore.characters = arr("characters");
    empty.identified_lore.locations = arr("locations");
    empty.identified_lore.objects = arr("objects");
  }
  const beats = o["identified_beats"];
  if (Array.isArray(beats)) {
    for (const b of beats) {
      if (!b || typeof b !== "object") continue;
      const B = b as Record<string, unknown>;
      const summary = String(B["summary"] ?? "").trim();
      if (!summary) continue;
      const order = Number(B["plot_point_order"]);
      empty.identified_beats.push({
        summary,
        plot_point_order: Number.isFinite(order) ? Math.max(0, Math.min(99, Math.floor(order))) : 0,
      });
    }
  }
  const conflicts = o["conflicts"];
  if (Array.isArray(conflicts)) {
    empty.conflicts.push(...conflicts.map((c) => String(c).trim()).filter(Boolean));
  }
  return empty;
}

function loreKey(kind: "c" | "l" | "o", index: number, label: string): string {
  return `${kind}:${index}:${label}`;
}

function beatKey(index: number): string {
  return `b:${index}`;
}

function buildCommitExcerpt(params: {
  filename: string;
  digest: string;
  discovery: DiscoveryPayload;
  verified: Set<string>;
  conflictNotes: Array<{ conflict: string; mode: "resolved" | "approved"; reply: string }>;
}): string {
  const { filename, digest, discovery, verified, conflictNotes } = params;
  const lines: string[] = [
    "# Planning discovery ingest (author-verified)",
    "",
    `**Source:** ${filename}`,
    `**Content digest:** ${digest || "(none)"}`,
    "",
    "## Verified lore — characters",
  ];
  const { characters, locations, objects } = discovery.identified_lore;
  characters.forEach((name, i) => {
    if (verified.has(loreKey("c", i, name))) lines.push(`- ${name}`);
  });
  lines.push("", "## Verified lore — locations");
  locations.forEach((name, i) => {
    if (verified.has(loreKey("l", i, name))) lines.push(`- ${name}`);
  });
  lines.push("", "## Verified lore — objects");
  objects.forEach((name, i) => {
    if (verified.has(loreKey("o", i, name))) lines.push(`- ${name}`);
  });
  lines.push("", "## Verified plot beats");
  discovery.identified_beats.forEach((b, i) => {
    if (verified.has(beatKey(i))) {
      lines.push(`- **Order ${b.plot_point_order}:** ${b.summary}`);
    }
  });
  lines.push("", "## Conflict decisions (Librarian interview)");
  conflictNotes.forEach((row, i) => {
    lines.push(`### ${i + 1}. ${row.mode === "approved" ? "Approved" : "Resolved"}`);
    lines.push(`- **Flag:** ${row.conflict}`);
    lines.push(`- **Record as:** ${row.reply.trim()}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

/**
 * Upload planning docs for discovery_mode analysis, verify extracted lore/beats,
 * resolve conflicts in small interview panels, then commit one wiki snapshot via lore-git.
 */
export function IngestDiscoveryDashboard({ projectId, getAccessToken }: IngestDiscoveryDashboardProps) {
  const { appendInterviewTurn } = usePlanningSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<{
    filename: string;
    digest: string;
    windowCount: number;
    wordCount: number;
  } | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryPayload | null>(null);
  const [windowErrors, setWindowErrors] = useState<Array<{ index: number; message: string }>>([]);
  const [verified, setVerified] = useState<Set<string>>(() => new Set());
  const [conflictState, setConflictState] = useState<
    Record<number, { status: "open" | "resolved" | "approved"; draft: string }>
  >({});
  const [committing, setCommitting] = useState(false);

  const allKeys = useMemo(() => {
    if (!discovery) return [] as string[];
    const keys: string[] = [];
    const { characters, locations, objects } = discovery.identified_lore;
    characters.forEach((n, i) => keys.push(loreKey("c", i, n)));
    locations.forEach((n, i) => keys.push(loreKey("l", i, n)));
    objects.forEach((n, i) => keys.push(loreKey("o", i, n)));
    discovery.identified_beats.forEach((_, i) => keys.push(beatKey(i)));
    return keys;
  }, [discovery]);

  const resetSessionForDiscovery = useCallback((d: DiscoveryPayload) => {
    setDiscovery(d);
    setVerified(new Set());
    const next: Record<number, { status: "open" | "resolved" | "approved"; draft: string }> = {};
    d.conflicts.forEach((_, i) => {
      next[i] = { status: "open", draft: "" };
    });
    setConflictState(next);
  }, []);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file || busy) return;
      if (!projectId?.trim()) {
        setError("Set manuscript / project id so lore-git commit can scope project_id.");
        return;
      }
      setError(null);
      setBusy(true);
      setLastMeta(null);
      setWindowErrors([]);
      try {
        const token = await getAccessToken();
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(bffUrl("/api/ingest/upload"), {
          method: "POST",
          ...bffCredentials,
          headers: bffAuthHeaders(token),
          body: fd,
        });
        const json = (await readJson(res)) as IngestUploadJson;
        if (!res.ok) {
          throw new Error(json.message || json.error || res.statusText);
        }
        if (json.success === false) {
          throw new Error(json.error || "Upload failed");
        }
        const disc = normalizeDiscovery(json.discovery);
        setLastMeta({
          filename: json.original_filename || file.name,
          digest: json.content_digest || "",
          windowCount: typeof json.window_count === "number" ? json.window_count : 0,
          wordCount: typeof json.markdown_word_count === "number" ? json.markdown_word_count : 0,
        });
        setWindowErrors(Array.isArray(json.window_errors) ? json.window_errors : []);
        resetSessionForDiscovery(disc);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setDiscovery(null);
      } finally {
        setBusy(false);
      }
    },
    [busy, getAccessToken, projectId, resetSessionForDiscovery]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    disabled: busy,
    maxFiles: 1,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
  });

  const toggleVerified = (key: string) => {
    setVerified((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateConflictDraft = (index: number, draft: string) => {
    setConflictState((prev) => ({
      ...prev,
      [index]: { ...(prev[index] ?? { status: "open" as const, draft: "" }), draft },
    }));
  };

  const markConflictResolved = (index: number) => {
    const row = conflictState[index];
    const text = (row?.draft ?? "").trim();
    if (text.length < 15) {
      setError("Resolve: enter at least 15 characters explaining how to record this in the wiki.");
      return;
    }
    setError(null);
    setConflictState((prev) => ({
      ...prev,
      [index]: { status: "resolved", draft: text },
    }));
  };

  const markConflictApproved = (index: number) => {
    setError(null);
    setConflictState((prev) => ({
      ...prev,
      [index]: {
        status: "approved",
        draft:
          (prev[index]?.draft ?? "").trim() ||
          "Author approved: align wiki / sandbox with this planning document for the flagged contradiction.",
      },
    }));
  };

  const conflictsHandled = useMemo(() => {
    if (!discovery) return false;
    if (discovery.conflicts.length === 0) return true;
    return discovery.conflicts.every((_, i) => {
      const s = conflictState[i]?.status;
      return s === "resolved" || s === "approved";
    });
  }, [conflictState, discovery]);

  const loreBeatsVerified = useMemo(() => {
    if (!discovery) return false;
    if (allKeys.length === 0) return true;
    return allKeys.every((k) => verified.has(k));
  }, [allKeys, discovery, verified]);

  const hasCommitPayload = useMemo(() => {
    if (!discovery) return false;
    const hasLoreOrBeats =
      discovery.identified_lore.characters.length +
        discovery.identified_lore.locations.length +
        discovery.identified_lore.objects.length +
        discovery.identified_beats.length >
      0;
    const hasConflicts = discovery.conflicts.length > 0;
    return hasLoreOrBeats || hasConflicts;
  }, [discovery]);

  const canCommit =
    Boolean(discovery && lastMeta && projectId?.trim()) &&
    hasCommitPayload &&
    loreBeatsVerified &&
    conflictsHandled &&
    !committing &&
    !busy;

  const runCommit = useCallback(async () => {
    if (!canCommit || !discovery || !lastMeta) return;
    setCommitting(true);
    setError(null);
    try {
      const token = await getAccessToken();

      const conflictNotes = discovery.conflicts.map((c, i) => {
        const row = conflictState[i];
        const mode = row?.status === "approved" ? "approved" : "resolved";
        const reply =
          row?.status === "approved"
            ? row.draft.trim()
            : row?.draft.trim() || "Resolved by author.";
        return { conflict: c, mode, reply };
      });

      const excerpt = buildCommitExcerpt({
        filename: lastMeta.filename,
        digest: lastMeta.digest,
        discovery,
        verified,
        conflictNotes,
      });

      if (excerpt.length < 20) {
        throw new Error("Verified excerpt too short to commit (need substantive content).");
      }

      const res = await fetch(bffUrl("/api/lore-git/commit"), {
        method: "POST",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lore_extraction_commit: true,
          project_id: projectId?.trim() || null,
          proposed_chunk: {
            title: `Discovery ingest — ${lastMeta.filename}`,
            excerpt,
            chunk_type: "planning",
            tags: ["discovery_mode", "planning_ingest", "wiki_verification"],
          },
          stylistic_metadata: {},
        }),
      });
      const json = (await readJson(res)) as { error?: string; success?: boolean };
      if (!res.ok) {
        throw new Error(json.error || res.statusText);
      }

      appendInterviewTurn(
        `Discovery ingest committed: ${lastMeta.filename}`,
        excerpt.slice(0, 600) + (excerpt.length > 600 ? "…" : "")
      );
      setDiscovery(null);
      setVerified(new Set());
      setConflictState({});
      setLastMeta(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  }, [
    appendInterviewTurn,
    canCommit,
    conflictState,
    discovery,
    getAccessToken,
    lastMeta,
    projectId,
    verified,
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        Drop a planning document. The BFF runs <code className="text-zinc-300">discovery_mode</code> in windows, then
        verify lore and beats. Resolve or approve each conflict below; only then can you commit to the wiki draft via{" "}
        <code className="text-zinc-300">POST /api/lore-git/commit</code>.
      </p>

      <div
        {...getRootProps()}
        className={[
          "flex min-h-[9rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
          isDragActive ? "border-violet-500 bg-violet-950/30" : "border-zinc-600 bg-zinc-900/40",
          busy ? "pointer-events-none opacity-60" : "hover:border-zinc-500 hover:bg-zinc-900/60",
        ].join(" ")}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium text-zinc-200">
          {busy ? "Analyzing…" : "Drop a file here, or click to choose"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">.docx, .doc, .pdf, .txt — one file at a time</p>
      </div>

      {lastMeta ? (
        <p className="text-xs text-zinc-500">
          Last file: <span className="text-zinc-300">{lastMeta.filename}</span> · {lastMeta.wordCount} words ·{" "}
          {lastMeta.windowCount} windows · digest <code className="text-zinc-400">{lastMeta.digest}</code>
        </p>
      ) : null}

      {windowErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-100/90">
          <p className="font-semibold text-amber-200/90">Some windows failed (discovery may be partial)</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {windowErrors.map((w) => (
              <li key={w.index}>
                Window {w.index + 1}: {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {discovery && lastMeta ? (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">Verification checklist</h3>
            <p className="text-xs text-zinc-500">Check each item you have reviewed and accept for wiki recording.</p>

            {discovery.identified_lore.characters.length > 0 ? (
              <ChecklistBlock title="Characters">
                {discovery.identified_lore.characters.map((name, i) => {
                  const id = loreKey("c", i, name);
                  return (
                    <label key={id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        className="mt-1 accent-violet-600"
                        checked={verified.has(id)}
                        onChange={() => toggleVerified(id)}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </ChecklistBlock>
            ) : null}

            {discovery.identified_lore.locations.length > 0 ? (
              <ChecklistBlock title="Locations">
                {discovery.identified_lore.locations.map((name, i) => {
                  const id = loreKey("l", i, name);
                  return (
                    <label key={id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        className="mt-1 accent-violet-600"
                        checked={verified.has(id)}
                        onChange={() => toggleVerified(id)}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </ChecklistBlock>
            ) : null}

            {discovery.identified_lore.objects.length > 0 ? (
              <ChecklistBlock title="Objects">
                {discovery.identified_lore.objects.map((name, i) => {
                  const id = loreKey("o", i, name);
                  return (
                    <label key={id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        className="mt-1 accent-violet-600"
                        checked={verified.has(id)}
                        onChange={() => toggleVerified(id)}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </ChecklistBlock>
            ) : null}

            {discovery.identified_beats.length > 0 ? (
              <ChecklistBlock title="Plot beats">
                {discovery.identified_beats.map((b, i) => {
                  const id = beatKey(i);
                  return (
                    <label key={id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        className="mt-1 accent-violet-600"
                        checked={verified.has(id)}
                        onChange={() => toggleVerified(id)}
                      />
                      <span>
                        <span className="text-zinc-500">Order {b.plot_point_order}:</span> {b.summary}
                      </span>
                    </label>
                  );
                })}
              </ChecklistBlock>
            ) : null}

            {allKeys.length === 0 ? (
              <p className="text-xs text-zinc-500">No lore entries or beats in this response — conflicts only.</p>
            ) : null}
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">The interview (conflicts)</h3>
            {discovery.conflicts.length === 0 ? (
              <p className="text-xs text-zinc-500">No internal contradictions flagged in this pass.</p>
            ) : (
              discovery.conflicts.map((conflict, index) => {
                const st = conflictState[index]?.status ?? "open";
                const draft = conflictState[index]?.draft ?? "";
                const locked = st === "resolved" || st === "approved";
                const librarianQuestion = `In the bible you wrote one thing, but this doc paints a different picture: “${conflict}”. How should I record this in the wiki so canon and sandbox stay aligned?`;

                return (
                  <div
                    key={`conflict-${index}`}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-200"
                  >
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
                        Librarian
                      </p>
                      <p className="whitespace-pre-wrap text-zinc-100">{librarianQuestion}</p>
                    </div>
                    {locked ? (
                      <p className="mt-2 text-xs text-emerald-400/90">
                        {st === "approved" ? "Approved." : "Resolved."} Recording: {draft.slice(0, 280)}
                        {draft.length > 280 ? "…" : ""}
                      </p>
                    ) : (
                      <>
                        <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Your answer
                        </label>
                        <textarea
                          value={draft}
                          onChange={(e) => updateConflictDraft(index, e.target.value)}
                          rows={3}
                          placeholder="e.g. Record Mib as 3 ft in canon; the giant line is unreliable narration in this outline only."
                          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => markConflictResolved(index)}
                            className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => markConflictApproved(index)}
                            className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                          >
                            Approve
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          Resolve requires at least 15 characters. Approve records alignment with this doc (optional
                          note in the box).
                        </p>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              {!loreBeatsVerified ? "Check every lore item and beat to enable commit." : null}
              {loreBeatsVerified && !conflictsHandled ? "Resolve or approve every conflict to enable commit." : null}
              {loreBeatsVerified && conflictsHandled && !hasCommitPayload ? "Nothing substantive to commit." : null}
            </p>
            <button
              type="button"
              disabled={!canCommit}
              onClick={() => void runCommit()}
              className="rounded-md border border-emerald-700/60 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-40"
            >
              {committing ? "Committing…" : "Commit verified discovery to wiki"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChecklistBlock(props: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{props.title}</p>
      <div className="mt-2 space-y-2">{props.children}</div>
    </div>
  );
}
