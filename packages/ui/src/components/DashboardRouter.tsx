"use client";

import type { HTMLAttributes } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { cn } from "../lib/cn";

import { MarketingLogForm } from "./MarketingLogForm";

export type DashboardMode = "PLANNING" | "DRAFTING" | "REVISION" | "BUSINESS" | "GROWTH";

/** Payload from `DashboardOrchestratorService.getDashboardViewData` (shape aligned server-side). */
export type DashboardViewPayload = Record<string, unknown> & {
  mode: DashboardMode;
  manuscriptId: string;
  tenantId: string;
  revision_lock_active?: boolean;
  data: Record<string, unknown>;
};

export type DashboardRouterProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  supabase: SupabaseClient;
  manuscriptId: string;
  tenantId: string;
  /** Typically calls your API wrapping `DashboardOrchestratorService`. */
  loadView: (mode: DashboardMode) => Promise<DashboardViewPayload>;
  initialMode?: DashboardMode;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function MockStripeStream() {
  const [usd, setUsd] = useState(12840);
  useEffect(() => {
    const id = window.setInterval(() => {
      setUsd((x) => Math.max(0, Math.round(x + (Math.random() - 0.45) * 420)));
    }, 2200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">Mock Stripe stream</p>
      <p className="mt-1 font-mono text-lg tabular-nums">${usd.toLocaleString("en-US")} YTD (simulated)</p>
    </div>
  );
}

function LinguisticDnaChart({ trajectory }: { trajectory: Array<{ craft: { ttr: number; sentenceComplexity: number } }> }) {
  const w = 320;
  const h = 120;
  const pad = 8;
  if (trajectory.length < 2) {
    return <p className="text-xs text-zinc-500">Not enough HAL sessions to chart linguistic DNA yet.</p>;
  }
  const n = trajectory.length;
  const norm = (vals: number[]) => {
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1e-6;
    return vals.map((v) => (v - lo) / span);
  };
  const tNorm = norm(trajectory.map((p) => p.craft.ttr));
  const cNorm = norm(trajectory.map((p) => p.craft.sentenceComplexity));
  const line = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
        const y = pad + (1 - v) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const polyT = line(tNorm);
  const polyC = line(cNorm);

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Linguistic DNA (15-session craft)</p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-zinc-200">
        <polyline fill="none" stroke="rgb(52 211 153)" strokeWidth="2" points={polyT} />
        <polyline fill="none" stroke="rgb(125 211 252)" strokeWidth="2" points={polyC} />
      </svg>
      <div className="flex gap-4 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> TTR (norm)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-300" /> Sentence complexity (norm)
        </span>
      </div>
    </div>
  );
}

const MODES: DashboardMode[] = ["PLANNING", "DRAFTING", "REVISION", "BUSINESS", "GROWTH"];

function HelperProofAuditPanel({
  dashboardData,
  manuscriptId,
  supabase,
  onVerified,
}: {
  dashboardData: Record<string, unknown>;
  manuscriptId: string;
  supabase: SupabaseClient;
  onVerified: () => void;
}) {
  const hp = dashboardData["helper_proof"];
  if (!hp || typeof hp !== "object") return null;
  const proof = asObj(hp);
  const stagesRaw = proof["stages"];
  const stages = Array.isArray(stagesRaw)
    ? (stagesRaw as unknown[]).map((s) => {
        const o = asObj(s);
        return {
          milestone_type: String(o["milestone_type"] ?? ""),
          file_url: o["file_url"] != null ? String(o["file_url"]) : null,
          uploaded_at: o["uploaded_at"] != null ? String(o["uploaded_at"]) : null,
        };
      })
    : [];
  const allUploaded = proof["all_milestones_uploaded"] === true;
  const verifiedAt = proof["verified_human_flow_at"] != null ? String(proof["verified_human_flow_at"]) : null;
  const guildCount = proof["guild_verified_project_count"];
  const guildLabel =
    typeof guildCount === "number" && Number.isFinite(guildCount) ? String(guildCount) : "—";

  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const onVerify = async () => {
    setLocalErr(null);
    setBusy(true);
    try {
      const ts = new Date().toISOString();
      const { error } = await supabase
        .from("p4_manuscripts")
        .update({ verified_human_flow_at: ts })
        .eq("id", manuscriptId);
      if (error) {
        setLocalErr(error.message);
        return;
      }
      onVerified();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-teal-900/40 bg-teal-950/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-teal-100">Verify progress — human labor audit</h3>
          <p className="mt-1 max-w-xl text-xs text-teal-200/75">
            Review SEED → GROWTH → HARVEST artifacts from your helper before payout or final approval. Confirming records
            verified human flow for this manuscript and counts toward your guild tier once milestones are complete.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-[10px] uppercase tracking-wide text-teal-400/90">Guild verified projects</p>
          <p className="font-mono text-lg text-teal-50">{guildLabel}</p>
        </div>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {stages.map((s) => {
          const ok = Boolean(s.file_url?.trim());
          return (
            <li
              key={s.milestone_type}
              className={cn(
                "rounded-lg border px-3 py-3",
                ok ? "border-teal-700/50 bg-teal-950/35" : "border-zinc-800/80 bg-zinc-950/40 opacity-80"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">{s.milestone_type}</p>
              {ok ? (
                <>
                  <a
                    href={s.file_url!}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block truncate text-xs text-sky-300 underline decoration-sky-500/50 hover:text-sky-200"
                  >
                    {s.file_url}
                  </a>
                  <p className="mt-1 text-[10px] text-zinc-500">{s.uploaded_at ?? ""}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Not uploaded yet.</p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-teal-900/30 pt-4">
        {verifiedAt ? (
          <p className="text-xs text-emerald-300/90">
            Verified human flow at <span className="font-mono text-emerald-200">{verifiedAt}</span>
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled={!allUploaded || busy}
              onClick={() => void onVerify()}
              className={cn(
                "rounded-lg border px-4 py-2 text-xs font-semibold transition",
                allUploaded && !busy
                  ? "border-teal-500/60 bg-teal-900/40 text-teal-50 hover:bg-teal-800/50"
                  : "cursor-not-allowed border-zinc-700 bg-zinc-900/60 text-zinc-500"
              )}
            >
              {busy ? "Saving…" : "Verify progress"}
            </button>
            {!allUploaded ? (
              <p className="text-xs text-amber-200/80">All three milestones must be uploaded before you can verify.</p>
            ) : (
              <p className="text-xs text-zinc-500">Database rules require all stages before this timestamp is accepted.</p>
            )}
          </>
        )}
      </div>
      {localErr ? <p className="mt-2 text-xs text-red-400">{localErr}</p> : null}
    </section>
  );
}

function MarketplaceHubStrip({ dashboardData }: { dashboardData: Record<string, unknown> }) {
  if (!("marketplace" in dashboardData) || !("marketplace_interest" in dashboardData)) return null;
  const m = asObj(dashboardData["marketplace"]);
  const interest = asObj(dashboardData["marketplace_interest"]);
  const intent = String(m["publishing_intent"] ?? "UNDECIDED");
  const showHelper = m["show_helper_hub"] === true;
  const showPublisher = m["show_publisher_hub"] === true;
  const seeking = m["is_seeking_agent"] === true;
  const unique = interest["unique_interested_parties"];
  const likes = interest["like_count"];
  const tracks = interest["track_count"];

  return (
    <section className="rounded-xl border border-violet-900/35 bg-violet-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-violet-100">Marketplace hubs</h3>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-violet-300/90">
          <span className="rounded border border-violet-800/60 px-2 py-0.5">Intent: {intent}</span>
          {seeking ? (
            <span className="rounded border border-emerald-800/50 px-2 py-0.5 text-emerald-200/90">Seeking agent</span>
          ) : (
            <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-500">Not seeking agent</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-violet-200/70">
        Competition signal:{" "}
        <span className="font-mono text-violet-100">
          {String(unique ?? "—")} interested parties
        </span>{" "}
        (distinct actors, anonymized) · {String(likes ?? "—")} likes · {String(tracks ?? "—")} tracks
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-lg border px-3 py-3",
            showHelper ? "border-violet-700/50 bg-violet-950/40" : "border-zinc-800/80 bg-zinc-950/50 opacity-60"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">Helper Hub</p>
          {showHelper ? (
            <p className="mt-1 text-xs text-zinc-300">Indie tooling, formatter, and self-publishing helpers.</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Hidden for <span className="font-mono text-zinc-400">TRADITIONAL</span> intent — you are on the trade /
              representation path.
            </p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg border px-3 py-3",
            showPublisher ? "border-amber-800/45 bg-amber-950/25" : "border-zinc-800/80 bg-zinc-950/50 opacity-60"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Publisher Hub</p>
          {showPublisher ? (
            <p className="mt-1 text-xs text-zinc-300">Publisher previews, grants, and deal-room adjacent tools.</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              Hidden for <span className="font-mono text-zinc-400">SELF</span> intent — you are on the direct /
              self-publishing path.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const LORE_SPIKE_WINDOW_MS = 20 * 60 * 1000;
const LIVE_TOAST_DEBOUNCE_MS = 90 * 1000;
const LORE_SPIKE_MIN = 3;

function loreLikeKind(kind: string): boolean {
  const k = kind.toUpperCase();
  if (k.includes("LORE") && (k.includes("BOT") || k.includes("QUERY") || k.includes("ASK"))) return true;
  if (k.startsWith("LORE_BOT") || k.startsWith("LORE_QUERY") || k.startsWith("LOREBOT") || k.startsWith("FAN_LORE")) return true;
  return false;
}

export function DashboardRouter({
  supabase,
  manuscriptId,
  tenantId,
  loadView,
  initialMode = "PLANNING",
  className,
  ...rest
}: DashboardRouterProps) {
  const [mode, setMode] = useState<DashboardMode>(initialMode);
  const [payload, setPayload] = useState<DashboardViewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [revisionStatus, setRevisionStatus] = useState<string | null>(null);
  const [drawerPing, setDrawerPing] = useState(0);
  const [businessToast, setBusinessToast] = useState<{ title: string; body: string } | null>(null);
  const loreSpikeTimestampsRef = useRef<number[]>([]);
  const lastBusinessToastAtRef = useRef(0);

  const refreshRevisionStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("p4_manuscripts")
      .select("revision_status")
      .eq("id", manuscriptId)
      .maybeSingle();
    if (!error && data && typeof (data as { revision_status?: string }).revision_status === "string") {
      setRevisionStatus((data as { revision_status: string }).revision_status);
    }
  }, [supabase, manuscriptId]);

  const fetchMode = useCallback(
    async (m: DashboardMode) => {
      setLoading(true);
      setErr(null);
      try {
        const p = await loadView(m);
        setPayload(p);
        if (m === "REVISION") await refreshRevisionStatus();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [loadView, refreshRevisionStatus]
  );

  useEffect(() => {
    void fetchMode(mode);
  }, [mode, fetchMode]);

  useEffect(() => {
    void refreshRevisionStatus();
  }, [refreshRevisionStatus, drawerPing]);

  useEffect(() => {
    const channel = supabase
      .channel(`p4_author_signal:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "p4_author_signal",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (evt) => {
          const row = asObj(evt.new);
          const kind = String(row["kind"] ?? "");
          const mid = row["manuscript_id"];

          if (kind === "DRAWER_PROGRESS") {
            if (mid != null && String(mid) !== manuscriptId) return;
            setDrawerPing((n) => n + 1);
            if (mode === "REVISION") void fetchMode("REVISION");
          }

          if (mode !== "BUSINESS") return;
          if (mid != null && String(mid) !== manuscriptId) return;

          const now = Date.now();
          const pay = asObj(row["payload"]);
          const payloadSpike = pay["spike"] === true || pay["engagement_tier"] === "high";

          if (payloadSpike && now - lastBusinessToastAtRef.current > LIVE_TOAST_DEBOUNCE_MS) {
            lastBusinessToastAtRef.current = now;
            setBusinessToast({
              title: "Strong fan engagement",
              body: String(row["title"] ?? "Readers are reacting — check your signals list."),
            });
            return;
          }

          if (loreLikeKind(kind)) {
            const buf = loreSpikeTimestampsRef.current.filter((t) => now - t < LORE_SPIKE_WINDOW_MS);
            buf.push(now);
            loreSpikeTimestampsRef.current = buf;
            if (
              buf.length >= LORE_SPIKE_MIN &&
              now - lastBusinessToastAtRef.current > LIVE_TOAST_DEBOUNCE_MS
            ) {
              lastBusinessToastAtRef.current = now;
              loreSpikeTimestampsRef.current = [];
              setBusinessToast({
                title: "Lore Bot question spike",
                body: `${buf.length} lore-style questions from fans in ~${Math.round(
                  LORE_SPIKE_WINDOW_MS / 60_000
                )} minutes — good moment to engage or queue a canon touch-up.`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, manuscriptId, mode, fetchMode]);

  useEffect(() => {
    if (!businessToast) return;
    const id = window.setTimeout(() => setBusinessToast(null), 8500);
    return () => window.clearTimeout(id);
  }, [businessToast]);

  const data = payload?.data ?? null;

  const planning = useMemo(() => (mode === "PLANNING" && data ? data : null), [mode, data]);
  const drafting = useMemo(() => (mode === "DRAFTING" && data ? data : null), [mode, data]);
  const revision = useMemo(() => (mode === "REVISION" && data ? data : null), [mode, data]);
  const business = useMemo(() => (mode === "BUSINESS" && data ? data : null), [mode, data]);
  const growth = useMemo(() => (mode === "GROWTH" && data ? data : null), [mode, data]);

  const reportAnswer = useMemo(() => {
    if (!revision) return null;
    const rep = revision["latest_comprehensive_report"];
    if (!rep || typeof rep !== "object") return null;
    const lib = asObj(asObj(rep)["librarian"]);
    const ans = lib["answer"];
    return typeof ans === "string" ? ans : null;
  }, [revision]);

  const craftTrajectory = useMemo(() => {
    if (!growth) return [];
    const tr = growth["craft_trajectory"];
    if (!Array.isArray(tr)) return [];
    return tr.filter((x) => x && typeof x === "object" && asObj(x)["craft"]) as Array<{
      craft: { ttr: number; sentenceComplexity: number };
    }>;
  }, [growth]);

  return (
    <div className={cn("relative space-y-4", className)} {...rest}>
      {businessToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-sky-700/50 bg-sky-950/95 px-3 py-2 text-sm text-sky-50 shadow-lg shadow-black/40"
        >
          <p className="text-xs font-semibold text-sky-200">{businessToast.title}</p>
          <p className="mt-1 text-xs text-sky-100/90">{businessToast.body}</p>
          <button
            type="button"
            className="mt-2 text-[10px] uppercase tracking-wide text-sky-400 hover:text-sky-200"
            onClick={() => setBusinessToast(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              mode === m
                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-100"
                : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {drawerPing > 0 ? (
        <p className="text-xs text-emerald-400/90">
          Drawer signal received — revision status refreshed{mode === "REVISION" ? " (view reloaded)." : "."}
        </p>
      ) : null}

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {loading ? <p className="text-xs text-zinc-500">Loading…</p> : null}

      {data && typeof data === "object" ? <MarketplaceHubStrip dashboardData={data as Record<string, unknown>} /> : null}

      {data && typeof data === "object" ? (
        <HelperProofAuditPanel
          dashboardData={data as Record<string, unknown>}
          manuscriptId={manuscriptId}
          supabase={supabase}
          onVerified={() => void fetchMode(mode)}
        />
      ) : null}

      {planning ? (
        <section className="space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Planning — Bible & outline</h3>
          {typeof planning["manuscript_outline"] === "string" && planning["manuscript_outline"] ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Manuscript outline</p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900/80 p-2 text-xs text-zinc-200">
                {planning["manuscript_outline"]}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">No `p4_manuscripts.outline` text yet.</p>
          )}
          <ChunkList title="The Bible (lore)" rows={planning["bible"]} />
          <ChunkList title="Outline (plot chunks)" rows={planning["outline"]} />
        </section>
      ) : null}

      {drafting ? (
        <section className="space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Drafting — HAL pulse & velocity</h3>
          <p className="text-xs text-zinc-500">Business metrics are hidden in this mode.</p>
          {drafting["draftingEnabled"] === false ? (
            <p className="text-sm text-amber-300/90">Drafting disabled — revision lock active.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="HAL pulse (mean score)" value={fmt(asObj(drafting["hal_pulse"] ?? {})["mean_hal_score"])} />
                <Stat label="Typing pulse (mean)" value={fmt(asObj(drafting["hal_pulse"] ?? {})["mean_typing_score"])} />
                <Stat
                  label="Word velocity"
                  value={
                    drafting["word_count_velocity_wph"] != null
                      ? `${String(drafting["word_count_velocity_wph"])} wph`
                      : "—"
                  }
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Live HAL sessions</p>
                <ul className="mt-1 space-y-1 text-xs text-zinc-300">
                  {Array.isArray(drafting["hal_live"] && asObj(drafting["hal_live"])["recent_sessions"])
                    ? (asObj(drafting["hal_live"])["recent_sessions"] as unknown[]).map((s, i) => {
                        const o = asObj(s);
                        return (
                          <li key={i} className="rounded border border-zinc-800/80 bg-zinc-900/50 px-2 py-1 font-mono">
                            HAL {fmt(o["hal_score"])} · typing {fmt(o["typing_score"])} · words{" "}
                            {o["total_words"] != null ? String(o["total_words"]) : "—"}
                          </li>
                        );
                      })
                    : null}
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Word count</p>
                <p className="text-lg font-semibold text-zinc-100">
                  {String(asObj(drafting["current_chapter"] ?? {})["word_count"] ?? "—")}
                </p>
                {(() => {
                  const excerpt = String(
                    asObj(drafting["current_chapter"] ?? {})["live_excerpt"] ?? ""
                  ).trim();
                  if (!excerpt) {
                    return (
                      <p className="mt-2 text-xs text-zinc-500">
                        Draft in Google Docs with the HAL extension — sessions and word counts sync
                        here. This dashboard is not a drafting editor.
                      </p>
                    );
                  }
                  return (
                    <>
                      <p className="mt-2 text-[10px] text-zinc-500">
                        Last synced excerpt (write in Google Docs, not here)
                      </p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900/80 p-2 text-xs text-zinc-300">
                        {excerpt}
                      </pre>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </section>
      ) : null}

      {revision ? (
        <section className="space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Revision</h3>
          <p className="text-xs text-zinc-400">
            Status: <span className="font-mono text-zinc-200">{revisionStatus ?? String(revision["revision_status"] ?? "—")}</span>
          </p>
          {String(revision["revision_status"] ?? "") === "AUDITING_COMPLETE" && reportAnswer ? (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Comprehensive consistency report</p>
              <pre className="mt-1 max-h-[min(60vh,480px)] overflow-auto whitespace-pre-wrap rounded-md border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-50">
                {reportAnswer}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              Full comprehensive report appears when `revision_status === AUDITING_COMPLETE` and a completed audit queue
              row exists.
            </p>
          )}
          <AuditQueueList rows={revision["audit_queue"]} />
        </section>
      ) : null}

      {business ? (
        <section className="space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Business — fans & mock sales</h3>
          <LivePulseStrip pulse={business["live_pulse"]} />
          <BusinessActivityOverlay rows={business["business_activity_timeline"]} />
          <MarketingLogForm
            supabase={supabase}
            tenantId={tenantId}
            manuscriptId={manuscriptId}
            onRecorded={() => void fetchMode("BUSINESS")}
          />
          <CorrelationTable rows={business["marketing_hal_correlation"]} />
          <MarketingWinsTable rows={business["marketing_wins"]} />
          <MockStripeStream />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">p4_author_signal (fan engagement)</p>
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-xs">
              {Array.isArray(business["fan_signals"])
                ? (business["fan_signals"] as unknown[]).map((s) => {
                    const o = asObj(s);
                    return (
                      <li key={String(o["id"])} className="rounded border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                        <span className="font-medium text-zinc-200">{String(o["title"] ?? "")}</span>
                        <p className="text-zinc-500">{String(o["body"] ?? "").slice(0, 200)}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">{String(o["created_at"] ?? "")}</p>
                      </li>
                    );
                  })
                : (
                  <li className="text-zinc-500">No signals yet.</li>
                )}
            </ul>
          </div>
        </section>
      ) : null}

      {growth ? (
        <section className="space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-950/70 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Growth — milestones & linguistic DNA</h3>
          <LinguisticDnaChart trajectory={craftTrajectory} />
          {growth["growth_delta"] && typeof growth["growth_delta"] === "object" ? (
            <pre className="rounded-md border border-zinc-800 bg-zinc-900/80 p-2 text-[11px] text-zinc-400">
              {JSON.stringify(growth["growth_delta"], null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function LivePulseStrip({ pulse }: { pulse: unknown }) {
  if (!pulse || typeof pulse !== "object") {
    return <p className="text-xs text-zinc-500">Live pulse unavailable.</p>;
  }
  const o = asObj(pulse);
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-sky-900/40 bg-sky-950/25 px-3 py-2">
      <Stat label="Fan signals (24h)" value={String(o["total_signals"] ?? "—")} />
      <Stat label="Lore-style (24h)" value={String(o["lore_bot_question_like"] ?? "—")} />
      <Stat label="Drawer updates (24h)" value={String(o["drawer_progress"] ?? "—")} />
      <Stat label="Other touchpoints (24h)" value={String(o["other_fan_touchpoints"] ?? "—")} />
    </div>
  );
}

function BusinessActivityOverlay({ rows }: { rows: unknown }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No activity timeline yet — log a marketing win or wait for live fan signals on the same UTC day.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Live signals + manual wins (same calendar day, UTC)
      </p>
      <div className="mt-2 max-h-52 overflow-auto">
        <table className="w-full text-left text-[10px] text-zinc-300">
          <thead className="text-zinc-500">
            <tr>
              <th className="pb-1 pr-2">Date</th>
              <th className="pb-1 pr-2">Manual interactions</th>
              <th className="pb-1 pr-2">Manual $</th>
              <th className="pb-1 pr-2">Live signals</th>
              <th className="pb-1 pr-2">Top live kinds</th>
            </tr>
          </thead>
          <tbody>
            {(rows as unknown[]).map((r, i) => {
              const o = asObj(r);
              const kinds = asObj(o["live_by_kind"]);
              const top = Object.entries(kinds)
                .map(([k, v]) => [k, Number(v)] as const)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([k, n]) => `${k}×${n}`)
                .join(", ");
              return (
                <tr key={i} className="border-t border-zinc-800/80">
                  <td className="py-1 pr-2 font-mono">{String(o["date"] ?? "").slice(0, 10)}</td>
                  <td className="py-1 pr-2">{String(o["manual_interactions"] ?? 0)}</td>
                  <td className="py-1 pr-2">{Number(o["manual_sales_usd"] ?? 0).toFixed(2)}</td>
                  <td className="py-1 pr-2">{String(o["live_signal_count"] ?? 0)}</td>
                  <td className="py-1 pr-2 text-zinc-500">{top || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number" && Number.isFinite(v)) return v.toFixed(3);
  return String(v);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function ChunkList({ title, rows }: { title: string; rows: unknown }) {
  if (!Array.isArray(rows)) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-300">
        {(rows as unknown[]).map((r) => {
          const o = asObj(r);
          return (
            <li key={String(o["id"])} className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1">
              <span className="font-mono text-[10px] text-zinc-500">{String(o["source_document"] ?? "")}</span> ·{" "}
              {String(o["excerpt"] ?? "").slice(0, 120)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CorrelationTable({ rows }: { rows: unknown }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Writing vs market (by date)</p>
        <p className="mt-1 text-xs text-zinc-500">
          No correlation rows yet. After you run the migration, daily HAL sessions join same-day manual marketing entries in
          `p4_v_marketing_hal_correlation`.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Writing vs market (by date)</p>
      <div className="mt-2 max-h-48 overflow-auto">
        <table className="w-full text-left text-[10px] text-zinc-300">
          <thead className="text-zinc-500">
            <tr>
              <th className="pb-1 pr-2">Date</th>
              <th className="pb-1 pr-2">HAL</th>
              <th className="pb-1 pr-2">Words Σ</th>
              <th className="pb-1 pr-2">HAL μ</th>
              <th className="pb-1 pr-2">Platform</th>
              <th className="pb-1 pr-2">Interactions</th>
              <th className="pb-1 pr-2">$</th>
            </tr>
          </thead>
          <tbody>
            {(rows as unknown[]).map((r, i) => {
              const o = asObj(r);
              return (
                <tr key={i} className="border-t border-zinc-800/80">
                  <td className="py-1 pr-2 font-mono">{String(o["correlation_date"] ?? "").slice(0, 10)}</td>
                  <td className="py-1 pr-2">{String(o["writing_hal_sessions"] ?? "—")}</td>
                  <td className="py-1 pr-2">{String(o["writing_total_words_sampled"] ?? "—")}</td>
                  <td className="py-1 pr-2">{fmt(o["writing_mean_hal_score"])}</td>
                  <td className="py-1 pr-2">{o["marketing_platform"] != null ? String(o["marketing_platform"]) : "—"}</td>
                  <td className="py-1 pr-2">{o["marketing_interaction_count"] != null ? String(o["marketing_interaction_count"]) : "—"}</td>
                  <td className="py-1 pr-2">
                    {o["marketing_sales_revenue"] != null ? Number(o["marketing_sales_revenue"]).toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketingWinsTable({ rows }: { rows: unknown }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No manual marketing rows for this manuscript yet — log your first win above.
      </p>
    );
  }
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Recent manual entries</p>
      <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-300">
        {(rows as unknown[]).map((r) => {
          const o = asObj(r);
          return (
            <li key={String(o["id"])} className="rounded border border-zinc-800/80 bg-zinc-900/50 px-2 py-1 font-mono">
              {String(o["recorded_date"] ?? "").slice(0, 10)} · {String(o["platform"] ?? "")} · interactions{" "}
              {String(o["interaction_count"] ?? 0)} · comments {String(o["comment_count"] ?? 0)} · $
              {Number(o["sales_revenue"] ?? 0).toFixed(2)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AuditQueueList({ rows }: { rows: unknown }) {
  if (!Array.isArray(rows)) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">Audit queue</p>
      <ul className="mt-1 text-xs text-zinc-400">
        {(rows as unknown[]).map((r) => {
          const o = asObj(r);
          return (
            <li key={String(o["id"])}>
              {String(o["status"])} · p{String(o["priority"])} · report{" "}
              {o["has_comprehensive_report"] ? "yes" : "no"}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
