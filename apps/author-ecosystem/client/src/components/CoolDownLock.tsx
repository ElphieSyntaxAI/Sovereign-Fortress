import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  BicameralReportDashboard,
  type ContinuityBreak,
  type OutlineAdherenceRow,
  type RetrievalStats,
} from "./BicameralReportDashboard";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials } from "../lib/bffFetch";

/**
 * Vault Green — Phase 2 hardening accent (see `VaultProtector.tsx` emerald family).
 */
const VAULT_GREEN = {
  glow: "shadow-[0_0_72px_-14px_rgba(16,185,129,0.5)]",
  ring: "ring-emerald-500/40",
  border: "border-emerald-500/45",
  text: "text-emerald-50",
  muted: "text-emerald-100/80",
  mesh: "from-emerald-950/94 via-zinc-950/90 to-zinc-950/[0.97]",
} as const;

export type CoolDownManuscriptState = {
  /**
   * When `LOCKED`, the editor enters **Vault cooling** (Phase 2).
   * Parent may set this from `cooldown_revision_status` or editorial `revision_status`.
   */
  status?: string | null;
  revision_status?: string | null;
  cooldown_revision_status?: string | null;
  locked_until?: string | null;
  lock_expires_at?: string | null;
  revision_cooldown_until?: string | null;
};

export type CoolDownLockProps = {
  children: ReactNode;
  manuscript: CoolDownManuscriptState | null;
  /** When set, Vault overlay can poll `GET /api/manuscripts/:id/revision-dashboard` after the timer elapses. */
  manuscriptId?: string | null;
  /** After `POST /api/manuscripts/:id/unlock`, merge returned `manuscript` fields into app state (e.g. NarrativeContext). */
  onVaultSealed?: (manuscript: Record<string, unknown>) => void;
};

function parseDeadlineMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return t;
}

function resolveCountdownTarget(m: CoolDownManuscriptState): number | null {
  const candidates = [m.locked_until, m.revision_cooldown_until, m.lock_expires_at];
  for (const c of candidates) {
    const ms = parseDeadlineMs(c);
    if (ms != null && ms > Date.now()) return ms;
  }
  for (const c of candidates) {
    const ms = parseDeadlineMs(c);
    if (ms != null) return ms;
  }
  return null;
}

function formatCountdown(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return "0:00";
  const s = Math.floor(remainingMs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function isVaultCoolingLocked(m: CoolDownManuscriptState | null): boolean {
  if (!m) return false;
  if (m.status === "LOCKED") return true;
  if (m.cooldown_revision_status === "LOCKED") return true;
  return false;
}

const barSweep: CSSProperties = {
  animation: "es-vault-scan 2.4s ease-in-out infinite",
};

const barSweepDelayed: CSSProperties = {
  animation: "es-vault-scan 2.9s ease-in-out infinite",
  animationDelay: "0.4s",
};

type DashboardPayload = {
  continuityBreaks: ContinuityBreak[];
  outlineAdherence: OutlineAdherenceRow[];
  criticText: string | null;
  retrieval: RetrievalStats | null;
  librarianSummary: string | null;
};

function parseReportJson(raw: unknown): Pick<
  DashboardPayload,
  "continuityBreaks" | "outlineAdherence" | "retrieval" | "librarianSummary"
> {
  if (!raw || typeof raw !== "object") {
    return { continuityBreaks: [], outlineAdherence: [], retrieval: null, librarianSummary: null };
  }
  const j = raw as Record<string, unknown>;
  const ce = j["continuity_errors"];
  const oa = j["outline_adherence"];
  const ret = j["retrieval"];
  const continuityBreaks = Array.isArray(ce) ? (ce as ContinuityBreak[]) : [];
  const outlineAdherence = Array.isArray(oa) ? (oa as OutlineAdherenceRow[]) : [];
  const retrieval = ret && typeof ret === "object" ? (ret as RetrievalStats) : null;
  const sum = j["summary"];
  const librarianSummary = typeof sum === "string" && sum.trim() ? sum.trim() : null;
  return { continuityBreaks, outlineAdherence, retrieval, librarianSummary };
}

/**
 * Phase 2 — wraps the **editor** surface. When `manuscript.status === 'LOCKED'` or SSOT
 * `cooldown_revision_status === 'LOCKED'`, disables interaction and shows a **Vault Cooling**
 * overlay with countdown (`locked_until` / planning cooldown / tier lock) and a **Bicameral
 * Progress** bar (Librarian + Critic) in **Vault Green**.
 *
 * When the countdown completes, loads {@link BicameralReportDashboard} (Librarian lists, Critic card, retrieval stats,
 * **Seal the Revision** → `POST /api/manuscripts/:id/unlock`).
 *
 * @see VaultProtector.tsx — sibling gate UX for pact attestation.
 */
export function CoolDownLock(props: CoolDownLockProps) {
  const { children, manuscript, manuscriptId, onVaultSealed } = props;
  const locked = isVaultCoolingLocked(manuscript);
  const targetMs = useMemo(() => (manuscript ? resolveCountdownTarget(manuscript) : null), [manuscript]);
  const [now, setNow] = useState(() => Date.now());

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const [isSealing, setIsSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);

  useEffect(() => {
    if (!locked) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [locked]);

  const remaining = targetMs != null ? targetMs - now : null;
  const countdownLabel =
    remaining != null && Number.isFinite(remaining)
      ? remaining > 0
        ? formatCountdown(remaining)
        : "0:00"
      : "—";

  const coolingElapsed = remaining != null && Number.isFinite(remaining) && remaining <= 0;
  const vaultCooldownGateLocked = manuscript?.cooldown_revision_status === "LOCKED";
  const showBicameralDashboard = Boolean(locked && manuscriptId && coolingElapsed);
  const canSealRevision = Boolean(vaultCooldownGateLocked && coolingElapsed);

  const loadDashboard = useCallback(async () => {
    if (!manuscriptId) return;
    setDashLoading(true);
    setDashError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(`/api/manuscripts/${encodeURIComponent(manuscriptId)}/revision-dashboard`, {
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        librarian_report?: { report_json?: unknown } | null;
        critic_sensitivity_text?: string | null;
      };
      if (!res.ok) {
        throw new Error(json.error || res.statusText);
      }
      const parsed = parseReportJson(json.librarian_report?.report_json);
      setDashboard({
        ...parsed,
        criticText: json.critic_sensitivity_text ?? null,
      });
    } catch (e) {
      setDashError(e instanceof Error ? e.message : String(e));
      setDashboard(null);
    } finally {
      setDashLoading(false);
    }
  }, [manuscriptId]);

  useEffect(() => {
    if (!showBicameralDashboard || !manuscriptId) {
      setDashboard(null);
      setDashError(null);
      return;
    }
    void loadDashboard();
    const id = window.setInterval(() => void loadDashboard(), 14_000);
    return () => window.clearInterval(id);
  }, [showBicameralDashboard, manuscriptId, loadDashboard]);

  const handleSealRevision = useCallback(async () => {
    if (!manuscriptId || !canSealRevision) return;
    setIsSealing(true);
    setSealError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(`/api/manuscripts/${encodeURIComponent(manuscriptId)}/unlock`, {
        method: "POST",
        ...bffCredentials,
        headers: { ...bffAuthHeaders(token) },
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        manuscript?: Record<string, unknown>;
      };
      if (!res.ok) {
        throw new Error(json.error || res.statusText);
      }
      if (json.manuscript && onVaultSealed) {
        onVaultSealed(json.manuscript);
      }
    } catch (e) {
      setSealError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSealing(false);
    }
  }, [manuscriptId, canSealRevision, onVaultSealed]);

  return (
    <div className="relative">
      <div
        className={locked ? "pointer-events-none select-none opacity-40" : undefined}
        {...(locked ? { inert: true as boolean } : {})}
      >
        {children}
      </div>

      {locked ? (
        <div
          className={`pointer-events-auto absolute inset-0 z-[50] flex items-center justify-center overflow-y-auto rounded-xl bg-gradient-to-br ${VAULT_GREEN.mesh} p-4 ring-1 ${VAULT_GREEN.ring} ${VAULT_GREEN.glow} backdrop-blur-[3px]`}
          role="presentation"
        >
          <div
            className="pointer-events-auto relative mx-auto my-auto w-full max-w-3xl space-y-5 rounded-2xl border bg-zinc-950/70 p-6 shadow-2xl border-emerald-500/35 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vault-cooling-title"
            aria-describedby="vault-cooling-desc"
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.14] [background-image:radial-gradient(circle_at_15%_0%,rgba(52,211,153,0.45),transparent_42%),radial-gradient(circle_at_92%_18%,rgba(167,139,250,0.18),transparent_38%),repeating-linear-gradient(128deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_11px)]" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-400/95">
                  Vault cooling
                </p>
                <h2 id="vault-cooling-title" className={`mt-1 text-xl font-semibold tracking-tight ${VAULT_GREEN.text}`}>
                  Manuscript is hardening in the Vault
                </h2>
                <p id="vault-cooling-desc" className={`mt-2 max-w-prose text-sm leading-relaxed ${VAULT_GREEN.muted}`}>
                  Phase 2 read-only gate: inputs are frozen while the cool-down lock is active. Librarian and Critic run
                  bicameral passes for the revision report; work is being hardened under the Vault Seal.
                </p>
              </div>
              <div
                className={`min-w-[8.5rem] rounded-xl border px-4 py-3 text-center ${VAULT_GREEN.border} bg-emerald-950/50`}
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/85">Unlocks in</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-50">{countdownLabel}</p>
              </div>
            </div>

            <div className="relative space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-emerald-200/85">
                <span>Bicameral progress</span>
                <span className="text-emerald-400">Vault hardened</span>
              </div>
              <p className="text-xs text-zinc-500">
                AI Librarian (logic) and Critic (sensitivity) scan the Vault for the revision report — stateless
                enterprise APIs.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-emerald-200/90">
                    <span>Librarian</span>
                    <span className="text-emerald-400/90">Logic</span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-emerald-950/85 ring-1 ring-emerald-400/30">
                    <div
                      className="absolute inset-y-0 left-0 w-[70%] rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 opacity-95"
                      style={barSweep}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-fuchsia-200/90">
                    <span>Critic</span>
                    <span className="text-fuchsia-300/85">Sensitivity</span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-emerald-950/85 ring-1 ring-fuchsia-400/25">
                    <div
                      className="absolute inset-y-0 left-0 w-[58%] rounded-full bg-gradient-to-r from-emerald-600 via-fuchsia-400/90 to-emerald-500 opacity-95"
                      style={barSweepDelayed}
                    />
                  </div>
                </div>
              </div>
            </div>

            {showBicameralDashboard ? (
              dashLoading && !dashboard ? (
                <p className="text-center text-xs text-zinc-500">Loading bicameral audit…</p>
              ) : dashError ? (
                <p className="text-center text-xs text-rose-300" role="alert">
                  {dashError}
                </p>
              ) : dashboard ? (
                <BicameralReportDashboard
                  librarianSummary={dashboard.librarianSummary}
                  continuityBreaks={dashboard.continuityBreaks}
                  outlineAdherence={dashboard.outlineAdherence}
                  criticSensitivityText={dashboard.criticText}
                  retrieval={dashboard.retrieval}
                  onSealRevision={handleSealRevision}
                  isSealing={isSealing}
                  sealError={sealError}
                  canSeal={canSealRevision}
                />
              ) : (
                <p className="text-center text-xs text-zinc-500">Preparing revision dashboard…</p>
              )
            ) : null}
          </div>

          <style>{`
            @keyframes es-vault-scan {
              0% { transform: translateX(-18%); opacity: 0.55; }
              50% { transform: translateX(22%); opacity: 1; }
              100% { transform: translateX(-18%); opacity: 0.55; }
            }
          `}</style>
        </div>
      ) : null}
    </div>
  );
}
