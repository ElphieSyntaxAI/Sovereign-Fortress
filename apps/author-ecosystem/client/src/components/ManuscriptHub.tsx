import { useCallback, useEffect, useState, type FormEvent } from "react";

import { LinkSessionPanel } from "./LinkSessionPanel";
import { SwitchProjectDialog } from "./SwitchProjectDialog";
import { useNarrative } from "../context/NarrativeContext";
import { useActivateManuscript } from "../hooks/useActivateManuscript";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import {
  displayTitle,
  hubRowToSelection,
  type HubManuscript,
  type ManuscriptHubPayload,
  type PhaseColumns,
  type ProjectPhase,
} from "../lib/manuscriptTypes";

const PHASES: { id: ProjectPhase; label: string }[] = [
  { id: "idea", label: "Idea phase" },
  { id: "wip", label: "Work in progress" },
  { id: "finished", label: "Finished" },
];

function KanbanColumn(props: {
  label: string;
  items: HubManuscript[];
  activeId: string | null;
  onSelect: (row: HubManuscript) => void;
  onMovePhase: (row: HubManuscript, phase: ProjectPhase) => void;
}) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{props.label}</p>
      <ul className="mt-2 space-y-2">
        {props.items.length === 0 ? (
          <li className="text-xs text-zinc-600">—</li>
        ) : (
          props.items.map((row) => {
            const isActive = props.activeId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => props.onSelect(row)}
                  className={[
                    "w-full rounded-md border px-2 py-2 text-left text-xs transition",
                    isActive
                      ? "border-violet-500/60 bg-violet-950/40 text-violet-50"
                      : "border-zinc-800 bg-zinc-950/80 text-zinc-200 hover:border-zinc-600",
                  ].join(" ")}
                >
                  <span className="font-medium">{displayTitle(row)}</span>
                  {row.google_doc_id ? (
                    <span className="mt-0.5 block text-[10px] text-zinc-500">Doc linked · HAL on</span>
                  ) : null}
                </button>
                <select
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-[10px] text-zinc-400"
                  value={row.project_phase}
                  onChange={(e) => props.onMovePhase(row, e.target.value as ProjectPhase)}
                  aria-label={`Move ${displayTitle(row)}`}
                >
                  {PHASES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function KanbanBoard(props: {
  title: string;
  columns: PhaseColumns;
  activeId: string | null;
  onSelect: (row: HubManuscript) => void;
  onMovePhase: (row: HubManuscript, phase: ProjectPhase) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-200">{props.title}</h3>
      <div className="flex flex-wrap gap-2">
        {PHASES.map((p) => (
          <KanbanColumn
            key={p.id}
            label={p.label}
            items={props.columns[p.id]}
            activeId={props.activeId}
            onSelect={props.onSelect}
            onMovePhase={props.onMovePhase}
          />
        ))}
      </div>
    </section>
  );
}

export function ManuscriptHub() {
  const { selection } = useNarrative();
  const activate = useActivateManuscript();
  const [hub, setHub] = useState<ManuscriptHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<HubManuscript | null>(null);

  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookSeriesId, setNewBookSeriesId] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/manuscripts/hub"), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as ManuscriptHubPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || res.statusText);
      setHub(json);
      const st = await fetch(bffUrl("/api/google/oauth/status"), {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const stJson = (await st.json().catch(() => ({}))) as {
        connected?: boolean;
        google_email?: string | null;
      };
      setGoogleConnected(Boolean(stJson.connected));
      setGoogleEmail(stJson.google_email ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHub(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apiJson = async (path: string, init?: RequestInit) => {
    const token = await getPreferredBffBearer();
    const res = await fetch(bffUrl(path), {
      ...bffCredentials,
      ...init,
      headers: {
        ...bffAuthHeaders(token),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json;
  };

  const onSelectProject = (row: HubManuscript) => {
    if (selection?.manuscriptId === row.id) return;
    if (!selection) {
      void activate(hubRowToSelection(row));
      return;
    }
    setPendingSwitch(row);
  };

  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    void activate(hubRowToSelection(pendingSwitch));
    setPendingSwitch(null);
  };

  const onMovePhase = async (row: HubManuscript, phase: ProjectPhase) => {
    try {
      await apiJson(`/api/manuscripts/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ project_phase: phase }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const createSeries = async (e: FormEvent) => {
    e.preventDefault();
    const title = newSeriesTitle.trim();
    if (!title) return;
    try {
      await apiJson("/api/series", { method: "POST", body: JSON.stringify({ title }) });
      setNewSeriesTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createBook = async (e: FormEvent) => {
    e.preventDefault();
    const title = newBookTitle.trim();
    if (!title) return;
    try {
      await apiJson("/api/manuscripts", {
        method: "POST",
        body: JSON.stringify({
          title,
          series_id: newBookSeriesId.trim() || undefined,
        }),
      });
      setNewBookTitle("");
      setNewBookSeriesId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const activeId = selection?.manuscriptId ?? null;
  const seriesOptions = hub?.series.map((s) => s.series) ?? [];

  return (
    <div className="space-y-8">
      <SwitchProjectDialog
        open={pendingSwitch != null}
        target={pendingSwitch}
        currentTitle={selection?.title?.trim() || null}
        onConfirm={confirmSwitch}
        onCancel={() => setPendingSwitch(null)}
      />

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Create project</h2>
        <p className="text-xs text-zinc-500">
          Add a series folder or a standalone / series book. Connect Google, start a link session, report the doc
          from the HAL extension, then confirm Link session.
        </p>
        {googleConnected ? (
          <p className="text-xs text-emerald-400/90">
            Google connected{googleEmail ? ` as ${googleEmail}` : ""}.
          </p>
        ) : (
          <p className="text-xs text-amber-300/80">Connect Google below before linking a doc.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <form onSubmit={(e) => void createSeries(e)} className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">New series folder</p>
            <input
              value={newSeriesTitle}
              onChange={(e) => setNewSeriesTitle(e.target.value)}
              placeholder="Series title"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-full border border-violet-500/50 bg-violet-600/90 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Create series
            </button>
          </form>
          <form onSubmit={(e) => void createBook(e)} className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">New book</p>
            <input
              value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              placeholder="Book title"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <select
              value={newBookSeriesId}
              onChange={(e) => setNewBookSeriesId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="">Standalone (general books table)</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  In series: {s.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full border border-violet-500/50 bg-violet-600/90 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Create book
            </button>
          </form>
        </div>
      </section>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading project hub…</p>
      ) : hub && hub.unlinked.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-amber-900/30 bg-amber-950/15 p-4">
          <h2 className="text-sm font-semibold text-amber-100">Link session (Google + HAL)</h2>
          <p className="text-xs text-amber-200/70">
            OAuth lets the Librarian and website exchange doc context securely. You confirm the correct doc with
            Link session after the extension reports it.
          </p>
          <ul className="space-y-3">
            {hub.unlinked.map((row) => (
              <li key={row.id}>
                <LinkSessionPanel
                  row={row}
                  googleConnected={googleConnected}
                  onLinked={() => void load()}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && hub ? (
        <section className="space-y-6">
          <header>
            <h2 className="text-sm font-semibold text-zinc-100">Current projects</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Click a project to set the active manuscript (confirms switch for row-level security). Use the
              phase dropdown to move cards between columns.
            </p>
          </header>

          <KanbanBoard
            title="General books"
            columns={hub.standalone}
            activeId={activeId}
            onSelect={onSelectProject}
            onMovePhase={(row, phase) => void onMovePhase(row, phase)}
          />

          {hub.series.map(({ series, columns }) => (
            <KanbanBoard
              key={series.id}
              title={`Series · ${series.title}`}
              columns={columns}
              activeId={activeId}
              onSelect={onSelectProject}
              onMovePhase={(row, phase) => void onMovePhase(row, phase)}
            />
          ))}

          {hub.unlinked.length === 0 &&
          hub.standalone.idea.length +
            hub.standalone.wip.length +
            hub.standalone.finished.length ===
            0 &&
          hub.series.every(
            (s) =>
              s.columns.idea.length + s.columns.wip.length + s.columns.finished.length === 0
          ) ? (
            <p className="text-sm text-zinc-500">
              No linked projects yet — create a book and link a Google Doc above.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
