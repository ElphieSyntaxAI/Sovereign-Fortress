import { type SupabaseClient } from "@supabase/supabase-js";
import {
  DashboardRouter,
  type DashboardMode,
  type DashboardViewPayload,
} from "@elphie-syntax/ui/dashboard";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  mergeNotesForLibrarianSync,
  PlanningSessionProvider,
  usePlanningSession,
} from "../planning/PlanningSessionContext";
import { BrainPillarHealth } from "./BrainPillarHealth";
import { EditorRequestButton } from "./EditorRequestButton";
import { IngestDiscoveryDashboard } from "./IngestDiscoveryDashboard";
import { LibrarianInterviewChat } from "./LibrarianInterviewChat";
import { PlotSandboxPanel } from "./PlotSandboxPanel";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";
import { registerEditorStateProvider } from "../lib/editorSnapshotRegistry";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";

export type PlanningTabId = "wiki" | "interview" | "sandbox" | "discovery";

export type PlanningCommandCenterProps = {
  manuscriptId: string;
  tenantId: string;
  /** Optional: use an existing browser Supabase client instead of env-based creation. */
  supabase?: SupabaseClient | null;
  /**
   * Optional Bearer override (e.g. automation). Default: Supabase session access token when configured,
   * else the BFF httpOnly `author_bff_jwt` cookie (legacy bridge).
   */
  getAccessToken?: () => string | null | Promise<string | null>;
  initialTab?: PlanningTabId;
  /** When set, only these workspace tabs render (for routed Outline / ingest pages). */
  allowedTabs?: PlanningTabId[];
  /** Hide pillar health + sync toolbar when a dedicated route owns the header. */
  compactChrome?: boolean;
  /** When true, wiki scratch + sync are disabled (Wiki route boots read-only). */
  wikiReadOnly?: boolean;
  /**
   * When true, do not mount an inner PlanningSessionProvider — use the parent Outline (or page) provider.
   */
  useParentSession?: boolean;
};

const ALL_TABS: { id: PlanningTabId; label: string }[] = [
  { id: "wiki", label: "Wiki Architect" },
  { id: "interview", label: "Librarian Interview" },
  { id: "sandbox", label: "Plot Sandbox" },
  { id: "discovery", label: "Discovery ingest" },
];

function tabButtonClass(active: boolean): string {
  return [
    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
    active
      ? "border-violet-500/70 bg-violet-950/50 text-violet-100"
      : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
  ].join(" ");
}

type SyncPhase = "idle" | "absorbing" | "success" | "error";

export function SyncToLibrarianButton(props: {
  manuscriptId: string;
  tenantId: string;
  getAccessToken: () => string | null | Promise<string | null>;
  onSynced?: () => void;
}) {
  const { interviewTurns, plotBeats, wikiNotes, brainstormNotes } = usePlanningSession();
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [err, setErr] = useState<string | null>(null);

  const canSync = Boolean(props.manuscriptId.trim() && props.tenantId.trim());

  const run = async () => {
    if (!canSync || phase === "absorbing") return;
    setErr(null);
    setPhase("absorbing");
    try {
      const token = await props.getAccessToken();
      const id = props.manuscriptId.trim();
      const url = `/api/manuscripts/${encodeURIComponent(id)}/sync-session`;
      const res = await fetch(url, {
        method: "POST",
        ...bffCredentials,
        headers: {
          ...bffAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interviewTurns,
          plotBeats,
          wikiNotes: mergeNotesForLibrarianSync(wikiNotes, brainstormNotes),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
        warnings?: string[];
      };
      if (!res.ok) {
        throw new Error(json.error || res.statusText);
      }
      if (json.success === false) {
        setErr(json.warnings?.join(" ") || "Nothing was written — add wiki notes, interview turns, or plot beats.");
        setPhase("error");
        window.setTimeout(() => {
          setPhase("idle");
          setErr(null);
        }, 4500);
        return;
      }
      setPhase("success");
      props.onSynced?.();
      window.setTimeout(() => setPhase("idle"), 2800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("error");
      window.setTimeout(() => {
        setPhase("idle");
        setErr(null);
      }, 4500);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase === "absorbing" ? (
          <span className="text-xs text-amber-200/95" aria-live="polite">
            Librarian is absorbing lore…
          </span>
        ) : null}
        {phase === "success" ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-400" role="status">
            <span className="text-base leading-none" aria-hidden>
              ✓
            </span>
            Synced
          </span>
        ) : null}
        {phase === "error" && err ? (
          <span className="max-w-[18rem] text-right text-xs text-red-400">{err}</span>
        ) : null}
        <button
          type="button"
          disabled={!canSync || phase === "absorbing"}
          onClick={() => void run()}
          className="rounded-full border border-amber-600/70 bg-amber-950/50 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-900/60 disabled:opacity-40"
        >
          Sync to Librarian
        </button>
      </div>
    </div>
  );
}

export function SharedSessionDigest() {
  const { interviewTurns, plotBeats, wikiNotes, brainstormNotes, lastSandboxDualAudit } =
    usePlanningSession();
  const last = interviewTurns[interviewTurns.length - 1];
  return (
    <div className="space-y-3">
      <aside className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Shared session</p>
        <p className="mt-1">
          Interview turns: <span className="text-zinc-100">{interviewTurns.length}</span> · Plot beats:{" "}
          <span className="text-zinc-100">{plotBeats.length}</span>
        </p>
        {last ? (
          <p className="mt-2 line-clamp-2 text-zinc-400">
            Latest Q: <span className="text-zinc-200">{last.question}</span>
          </p>
        ) : null}
        {wikiNotes.trim() ? (
          <p className="mt-1 line-clamp-2 text-zinc-500">Wiki scratch: {wikiNotes.trim()}</p>
        ) : null}
        {brainstormNotes.trim() ? (
          <p className="mt-1 line-clamp-2 text-zinc-500">Brainstorm: {brainstormNotes.trim()}</p>
        ) : null}
      </aside>

      {lastSandboxDualAudit ? (
        <aside className="rounded-lg border border-violet-900/50 bg-violet-950/25 p-3 text-xs text-violet-100/90">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400/90">
            Latest simulate impact
          </p>
          <p className="mt-1 text-[11px] text-violet-200/80">
            Scene {lastSandboxDualAudit.sceneIndex + 1}: {lastSandboxDualAudit.sceneLabel}
          </p>
          <div className="mt-2 space-y-2 border-t border-violet-900/40 pt-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                Librarian (Logic)
              </p>
              <p className="mt-0.5 leading-relaxed text-violet-50/95">{lastSandboxDualAudit.librarianLogic}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200/85">
                Critic (Sensitivity)
              </p>
              <p className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-violet-100/90">
                {lastSandboxDualAudit.criticSensitivity}
              </p>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function WikiArchitectPanel(props: {
  supabase: SupabaseClient | null;
  manuscriptId: string;
  tenantId: string;
  loadView: (mode: DashboardMode) => Promise<DashboardViewPayload>;
  readOnly?: boolean;
}) {
  const { wikiNotes, setWikiNotes, interviewTurns, plotBeats } = usePlanningSession();

  return (
    <div className="space-y-4">
      {props.readOnly ? (
        <p className="text-xs text-zinc-500" role="status">
          Read-only — click the pencil in the page header to edit wiki scratch notes.
        </p>
      ) : null}
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          Wiki scratch (shared — visible on all tabs via digest / this field)
        </span>
        <textarea
          value={wikiNotes}
          onChange={(e) => setWikiNotes(e.target.value)}
          readOnly={props.readOnly}
          rows={3}
          className={[
            "w-full rounded-md border px-2 py-1.5 text-sm",
            props.readOnly
              ? "cursor-default border-zinc-800 bg-zinc-900/50 text-zinc-400"
              : "border-zinc-700 bg-zinc-950 text-zinc-100",
          ].join(" ")}
        />
      </label>
      {interviewTurns.length > 0 || plotBeats.length > 0 ? (
        <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-3 text-xs text-emerald-100/90">
          <p className="font-semibold text-emerald-200/90">Live session material</p>
          {interviewTurns.length > 0 ? (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {interviewTurns.slice(-5).map((t) => (
                <li key={t.id} className="text-emerald-100/80">
                  <span className="text-emerald-400/90">Q:</span> {t.question}
                </li>
              ))}
            </ul>
          ) : null}
          {plotBeats.length > 0 ? (
            <ul className="mt-2 list-disc pl-4">
              {plotBeats.map((b) => (
                <li key={b.id}>{b.synopsis}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {props.supabase ? (
        <DashboardRouter
          supabase={props.supabase}
          manuscriptId={props.manuscriptId}
          tenantId={props.tenantId}
          loadView={props.loadView}
          initialMode="PLANNING"
          className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"
        />
      ) : (
        <p className="text-sm text-amber-300/90">
          Set <code className="text-amber-200">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> (or pass a{" "}
          <code className="text-amber-200">supabase</code> prop) to mount the live wiki dashboard.
        </p>
      )}
    </div>
  );
}

function PlanningEditorSnapshotBridge() {
  const { interviewTurns, plotBeats, wikiNotes } = usePlanningSession();

  useEffect(() => {
    return registerEditorStateProvider(() => ({
      wiki_notes_excerpt: wikiNotes.slice(0, 4000),
      plot_beats_count: plotBeats.length,
      interview_turns_count: interviewTurns.length,
    }));
  }, [wikiNotes, plotBeats.length, interviewTurns.length]);

  return null;
}

function PlanningCommandCenterInner(props: PlanningCommandCenterProps) {
  const tabs = useMemo(() => {
    if (!props.allowedTabs?.length) return ALL_TABS;
    const allowed = new Set(props.allowedTabs);
    return ALL_TABS.filter((t) => allowed.has(t.id));
  }, [props.allowedTabs]);

  const defaultTab = props.initialTab ?? tabs[0]?.id ?? "wiki";
  const [tab, setTab] = useState<PlanningTabId>(defaultTab);

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) {
      setTab(tabs[0]?.id ?? "wiki");
    }
  }, [tabs, tab]);

  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const supabase = useMemo(() => {
    if (props.supabase !== undefined && props.supabase !== null) return props.supabase;
    if (props.supabase === null) return null;
    if (envUrl && envKey) return getSupabaseBrowserClient();
    return null;
  }, [props.supabase, envUrl, envKey]);

  const defaultGetToken = useCallback(() => getPreferredBffBearer(), []);

  const getToken = props.getAccessToken ?? defaultGetToken;

  const loadView = useCallback(
    async (mode: DashboardMode): Promise<DashboardViewPayload> => {
      const token = await getToken();
      const u = new URL(bffUrl("/api/dashboard/view"), window.location.origin);
      u.searchParams.set("mode", mode);
      u.searchParams.set("manuscript_id", props.manuscriptId);
      const res = await fetch(u.toString(), {
        ...bffCredentials,
        headers: bffAuthHeaders(token),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : res.statusText;
        throw new Error(err);
      }
      return json as DashboardViewPayload;
    },
    [getToken, props.manuscriptId]
  );

  const missingWikiIds = !props.manuscriptId.trim() || !props.tenantId.trim();

  let body: ReactNode;
  if (tab === "wiki") {
    if (missingWikiIds) {
      body = (
        <p className="text-sm text-amber-300/90">
          Set <code className="text-amber-200">VITE_PLANNING_MANUSCRIPT_ID</code> and{" "}
          <code className="text-amber-200">VITE_PLANNING_TENANT_ID</code> (or pass{" "}
          <code className="text-amber-200">manuscriptId</code> / <code className="text-amber-200">tenantId</code>{" "}
          props).
        </p>
      );
    } else {
      body = (
        <WikiArchitectPanel
          supabase={supabase}
          manuscriptId={props.manuscriptId}
          tenantId={props.tenantId}
          loadView={loadView}
          readOnly={props.wikiReadOnly}
        />
      );
    }
  } else if (tab === "interview") {
    body = (
      <LibrarianInterviewChat
        tenantId={props.tenantId.trim() || null}
        manuscriptId={props.manuscriptId.trim() || null}
        getAccessToken={getToken}
      />
    );
  } else if (tab === "discovery") {
    body = (
      <IngestDiscoveryDashboard projectId={props.manuscriptId.trim() || null} getAccessToken={getToken} />
    );
  } else {
    body = (
      <PlotSandboxPanel manuscriptId={props.manuscriptId} tenantId={props.tenantId} getAccessToken={getToken} />
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      {!props.compactChrome ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Planning command center</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <EditorRequestButton manuscriptId={props.manuscriptId} getAccessToken={getToken} />
              {!props.wikiReadOnly ? (
                <SyncToLibrarianButton
                  manuscriptId={props.manuscriptId}
                  tenantId={props.tenantId}
                  getAccessToken={getToken}
                />
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-900/35 bg-zinc-950/40 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">Tenant observability</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Logic drift and six-pillar stoplights — shared with Sentinel diagnostics.
            </p>
            <div className="mt-3">
              <BrainPillarHealth pollIntervalMs={20_000} lookbackHours={168} />
            </div>
          </div>
          <SharedSessionDigest />
        </>
      ) : null}
      <PlanningEditorSnapshotBridge />
      {tabs.length > 1 ? (
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Planning modes">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tabButtonClass(tab === t.id)}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      ) : null}
      <div role="tabpanel" className="min-h-[12rem]">
        {body}
      </div>
    </section>
  );
}

/**
 * Three-way workspace: Wiki Architect (hosts `DashboardRouter`), Librarian Interview, and Plot Sandbox.
 * All panels read/write the same {@link PlanningSessionState} via {@link PlanningSessionProvider}.
 */
export function OutlinePlanningSessionChrome(props: {
  manuscriptId: string;
  tenantId: string;
  onSynced?: () => void;
}) {
  const getToken = useCallback(() => getPreferredBffBearer(), []);
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-zinc-400">
          One shared outline session across all tabs. Interview, sandbox beats, wiki scratch, and
          brainstorm notes sync together.
        </p>
        <SyncToLibrarianButton
          manuscriptId={props.manuscriptId}
          tenantId={props.tenantId}
          getAccessToken={getToken}
          onSynced={props.onSynced}
        />
      </div>
      <SharedSessionDigest />
    </div>
  );
}

export function PlanningCommandCenter(props: PlanningCommandCenterProps) {
  if (props.useParentSession) {
    return <PlanningCommandCenterInner {...props} />;
  }
  return (
    <PlanningSessionProvider>
      <PlanningCommandCenterInner {...props} />
    </PlanningSessionProvider>
  );
}
