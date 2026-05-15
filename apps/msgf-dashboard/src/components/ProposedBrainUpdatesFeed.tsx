import { useCallback, useEffect, useState } from "react";

import {
  fetchProposedBrainUpdates,
  patchRuleGlobalReviewSubmission,
  type ProposedBrainUpdateDto,
} from "../lib/msgf-admin-api";

/**
 * Cross-company feed of proposed global Brain rules (logic patterns only; server-redacted).
 */
export function ProposedBrainUpdatesFeed() {
  const [items, setItems] = useState<ProposedBrainUpdateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProposedBrainUpdates({ limit: 30 });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load proposed Brain updates.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    try {
      await patchRuleGlobalReviewSubmission({
        id,
        action,
        reviewer_note: noteById[id]?.trim() || undefined,
      });
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-violet-900/40 bg-violet-950/10 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-violet-100">Proposed Brain updates</h2>
          <p className="text-xs text-violet-200/70">
            Logic patterns submitted by company admins for platform GLOBAL rules — no private source
            code or tenant identifiers in this feed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-violet-800/80 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-900/40 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading feed…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending proposed Brain updates.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => {
            const m = row.logic_pattern?.mitigation_action;
            return (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300"
              >
                <div className="font-mono text-[10px] text-zinc-500">
                  {row.bug_index_instance} · {new Date(row.created_at).toLocaleString()}
                </div>
                {m ? (
                  <div className="mt-2 space-y-1">
                    <div className="text-sm font-medium text-zinc-100">
                      {m.label ?? m.kind} {m.pillar ? `· ${m.pillar}` : ""}
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-400">
                      {m.fix_template?.trim() || "(no template)"}
                    </pre>
                    {row.logic_pattern?.human_reasoning ? (
                      <p className="text-zinc-500">{row.logic_pattern.human_reasoning}</p>
                    ) : null}
                    {row.note ? <p className="text-zinc-500">Note: {row.note}</p> : null}
                  </div>
                ) : (
                  <p className="mt-2 text-amber-400/90">Could not parse logic pattern payload.</p>
                )}
                <label className="mt-2 block text-[11px] text-zinc-500">
                  Reviewer note (optional)
                  <input
                    type="text"
                    value={noteById[row.id] ?? ""}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row.id, "approve")}
                    className="rounded-md bg-emerald-800/90 px-3 py-1.5 text-[11px] font-medium text-emerald-50 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve GLOBAL rule
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row.id, "reject")}
                    className="rounded-md border border-red-900/70 bg-red-950/50 px-3 py-1.5 text-[11px] font-medium text-red-100 hover:bg-red-900/40 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
