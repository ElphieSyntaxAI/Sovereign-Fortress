/**
 * Editor pre-flight briefing: HAL struggle map + latest Librarian / Critic snapshot.
 * Roadmap: `docs/AUTHOR_ROADMAP.md` → canonical `docs/AUTHOR_ECOSYSTEM_ROADMAP.md` (bicameral cooldown + forensic transparency).
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { bffAuthHeaders, bffCredentials } from "../../lib/bffFetch";

const LOGIC_GATE_PCT = 78;

export type EditorForensicDashboardProps = {
  manuscriptId: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  className?: string;
};

type StruggleTier = "FLOW" | "STANDARD" | "STRUGGLE";

type StruggleSegment = {
  segment_key: string;
  chapter_index: number | null;
  word_bin_index: number | null;
  hal_event_count: number;
  active_typing_duration_ms: number;
  net_word_gain: number;
  backspace_count: number;
  deletion_ratio: number;
  friction_score: number;
  tier: StruggleTier;
};

type StruggleMapPayload = {
  ok?: boolean;
  schema?: string;
  manuscript_id?: string;
  segments?: StruggleSegment[];
  empty_reason?: string;
  error?: string;
};

type ContinuityError = {
  type?: string;
  description?: string;
  manuscript_evidence?: string;
  canon_evidence?: string;
  severity?: string;
};

type LibrarianReportRow = {
  id?: string;
  locked_until_session?: string;
  report_json?: Record<string, unknown> | null;
  created_at?: string;
};

type RevisionDashboardPayload = {
  ok?: boolean;
  error?: string;
  manuscript?: Record<string, unknown>;
  librarian_report?: LibrarianReportRow | null;
  critic_sensitivity_text?: string | null;
  vault_cooldown_lock_elapsed?: boolean;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function segmentLabel(s: StruggleSegment): string {
  if (s.chapter_index != null) return `Ch. ${s.chapter_index + 1}`;
  if (s.word_bin_index != null) return `Words ${s.word_bin_index * 1_000}–${(s.word_bin_index + 1) * 1_000}`;
  return s.segment_key;
}

/** Words per second of active typing — higher = smoother cadence. */
function cadenceWps(s: StruggleSegment): number {
  const sec = Math.max(0.001, s.active_typing_duration_ms / 1000);
  return s.net_word_gain / sec;
}

/**
 * Rail intensity: emphasizes high deletion ratio and low cadence (per roadmap editor X-ray).
 */
function railIntensity(segments: StruggleSegment[], s: StruggleSegment): number {
  if (segments.length === 0) return 0;
  const maxDel = Math.max(1e-6, ...segments.map((x) => x.deletion_ratio));
  const cadences = segments.map(cadenceWps);
  const maxCad = Math.max(1e-6, ...cadences);
  const delN = s.deletion_ratio / maxDel;
  const cadN = cadenceWps(s) / maxCad;
  const lowCadence = 1 - cadN;
  return Math.min(1, 0.55 * delN + 0.45 * lowCadence);
}

function tierBarClass(tier: StruggleTier): string {
  if (tier === "STRUGGLE") return "bg-rose-500/90";
  if (tier === "STANDARD") return "bg-amber-400/85";
  return "bg-emerald-500/80";
}

function tierTrackClass(tier: StruggleTier): string {
  if (tier === "STRUGGLE") return "bg-rose-950/50 border-rose-900/50";
  if (tier === "STANDARD") return "bg-amber-950/40 border-amber-900/40";
  return "bg-emerald-950/35 border-emerald-900/45";
}

function parseContinuityErrors(reportJson: Record<string, unknown> | null | undefined): ContinuityError[] {
  if (!reportJson) return [];
  const raw = reportJson["continuity_errors"];
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === "object" && x ? (x as ContinuityError) : {}));
}

function criticalContinuityBreaks(errors: ContinuityError[], limit: number): ContinuityError[] {
  const high = errors.filter((e) => String(e.severity ?? "").toLowerCase() === "high");
  return high.slice(0, limit);
}

function logicScorePct(reportJson: Record<string, unknown> | null | undefined): number | null {
  if (!reportJson) return null;
  const ls = reportJson["logic_score"];
  if (typeof ls === "number" && Number.isFinite(ls)) return Math.round(Math.min(1, Math.max(0, ls)) * 100);
  return null;
}

export function EditorForensicDashboard(props: EditorForensicDashboardProps) {
  const { manuscriptId, getAccessToken, className = "" } = props;
  const railId = useId();

  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [struggle, setStruggle] = useState<StruggleMapPayload | null>(null);
  const [dash, setDash] = useState<RevisionDashboardPayload | null>(null);

  const defaultToken = useCallback(() => null as string | null, []);
  const getToken = getAccessToken ?? defaultToken;

  const load = useCallback(async () => {
    const id = manuscriptId.trim();
    if (!id) {
      setPhase("ready");
      setStruggle(null);
      setDash(null);
      return;
    }
    setPhase("loading");
    setErr(null);
    try {
      const token = await getToken();
      const headers = bffAuthHeaders(token);
      const base = `/api/manuscripts/${encodeURIComponent(id)}`;
      const [smRes, rvRes] = await Promise.all([
        fetch(`${base}/struggle-map`, { ...bffCredentials, headers }),
        fetch(`${base}/revision-dashboard`, { ...bffCredentials, headers }),
      ]);
      const smJson = (await smRes.json().catch(() => ({}))) as StruggleMapPayload;
      const rvJson = (await rvRes.json().catch(() => ({}))) as RevisionDashboardPayload;
      if (!smRes.ok) throw new Error(smJson.error || smRes.statusText);
      if (!rvRes.ok) throw new Error(rvJson.error || rvRes.statusText);
      setStruggle(smJson);
      setDash(rvJson);
      setPhase("ready");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [getToken, manuscriptId]);

  useEffect(() => {
    void load();
  }, [load]);

  const segments = struggle?.segments ?? [];
  const maxRail = useMemo(() => {
    if (segments.length === 0) return 1;
    return Math.max(0.08, ...segments.map((s) => railIntensity(segments, s)));
  }, [segments]);

  const librarianJson = asRecord(dash?.librarian_report?.report_json ?? null);
  const continuity = parseContinuityErrors(librarianJson);
  const topCritical = criticalContinuityBreaks(continuity, 3);
  const logicPct = logicScorePct(librarianJson);
  const lockedUntil =
    dash?.manuscript && dash.manuscript["locked_until"] != null
      ? String(dash.manuscript["locked_until"])
      : null;
  const criticTeaser =
    typeof dash?.critic_sensitivity_text === "string" ? dash.critic_sensitivity_text.trim().slice(0, 520) : "";

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-200 ${className}`.trim()}
      aria-labelledby={`${railId}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/90 pb-3">
        <div>
          <h2 id={`${railId}-title`} className="text-base font-semibold tracking-tight text-zinc-50">
            Editor pre-flight
          </h2>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-500">
            HAL cadence friction vs. last cooldown Librarian logic and Critic sensitivity — where discipline and
            continuity wavered before polish (see docs/AUTHOR_ECOSYSTEM_ROADMAP.md).
          </p>
        </div>
        {phase === "error" ? (
          <div className="flex flex-col items-end gap-1">
            <p className="max-w-xs text-right text-xs text-rose-400">{err}</p>
            <button
              type="button"
              className="text-xs text-violet-300 underline decoration-dotted underline-offset-2"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {phase === "loading" ? (
        <p className="mt-4 text-xs text-zinc-500" aria-live="polite">
          Loading forensic bundle…
        </p>
      ) : null}

      {phase === "ready" ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Friction rail</h3>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Taller bars = heavier deletion ratio and slower words-per-active-second cadence. Tier colors follow HAL
              aggregates (FLOW / STANDARD / STRUGGLE).
            </p>
            {segments.length === 0 ? (
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
                {struggle?.empty_reason ?? "No struggle segments for this manuscript yet."}
              </p>
            ) : (
              <div
                className="flex max-h-[min(70vh,28rem)] flex-col gap-2 overflow-y-auto pr-1"
                role="list"
                aria-label="Chapter and word-bin friction"
              >
                {segments.map((s) => {
                  const intensity = railIntensity(segments, s);
                  const pct = Math.round((intensity / maxRail) * 100);
                  const wps = cadenceWps(s);
                  const title = `${segmentLabel(s)} — deletion ratio ${(s.deletion_ratio * 100).toFixed(1)}%, cadence ${wps.toFixed(2)} w/s, tier ${s.tier}`;
                  return (
                    <div key={s.segment_key} className="flex items-center gap-2" role="listitem" title={title}>
                      <span className="w-24 shrink-0 truncate text-[11px] text-zinc-400" title={segmentLabel(s)}>
                        {segmentLabel(s)}
                      </span>
                      <div
                        className={`relative h-7 min-w-0 flex-1 overflow-hidden rounded-md border ${tierTrackClass(s.tier)}`}
                      >
                        <div
                          className={`h-full rounded-md transition-all ${tierBarClass(s.tier)}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-end px-2 text-[10px] font-medium text-zinc-100/90 mix-blend-plus-lighter">
                          Δ {(s.deletion_ratio * 100).toFixed(0)}% · {wps.toFixed(2)} w/s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-violet-900/45 bg-violet-950/20 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">Librarian snapshot</h3>
              {lockedUntil ? (
                <p className="mt-1 text-[10px] text-zinc-500">
                  Last lock session (UTC anchor): <span className="text-zinc-400">{lockedUntil}</span>
                </p>
              ) : null}
              <div className="mt-3 space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <span className="text-xs text-zinc-400">Logic score (last report)</span>
                  <span className="text-lg font-semibold tabular-nums text-violet-100">
                    {logicPct != null ? `${logicPct}%` : "—"}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="absolute bottom-0 left-0 top-0 rounded-full bg-violet-500/90"
                    style={{ width: `${logicPct != null ? Math.min(100, logicPct) : 0}%` }}
                  />
                  <div
                    className="absolute bottom-0 top-0 w-px bg-amber-300/90"
                    style={{ left: `${LOGIC_GATE_PCT}%` }}
                    title={`${LOGIC_GATE_PCT}% gate`}
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  Amber tick = {LOGIC_GATE_PCT}% editor-hub continuity gate. Librarian rows use{" "}
                  <code className="text-zinc-400">report_json.logic_score</code> when present.
                </p>
              </div>

              <div className="mt-4 border-t border-violet-900/40 pt-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-rose-300/85">
                  Top critical continuity breaks (last lock)
                </h4>
                {topCritical.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    No <span className="text-zinc-400">high</span> severity items in this Librarian JSON — clean pass
                    or report still pending.
                  </p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {topCritical.map((e, idx) => (
                      <li
                        key={`${idx}-${String(e.type ?? "t")}`}
                        className="rounded-md border border-rose-900/35 bg-rose-950/25 px-2.5 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="text-[11px] font-medium text-rose-100/95">
                            {idx + 1}. {String(e.type ?? "continuity")}
                          </span>
                          <span className="rounded-full bg-rose-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200/90">
                            {String(e.severity ?? "").toLowerCase() === "high" ? "Critical" : String(e.severity ?? "")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-rose-50/90">
                          {String(e.description ?? "").slice(0, 360)}
                          {String(e.description ?? "").length > 360 ? "…" : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/15 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300/85">Critic (sensitivity)</h3>
              {criticTeaser ? (
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-fuchsia-50/90">
                  {criticTeaser}
                  {dash?.critic_sensitivity_text && dash.critic_sensitivity_text.length > 520 ? "…" : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">No CRITIC_SUMMARY on file for this manuscript yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
