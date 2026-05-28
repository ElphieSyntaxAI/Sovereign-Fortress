import { classifyHttpError } from "./classifyHttpError";
import type { IdeStatusBarSnapshot } from "./ide-types";
import { MSGF_RBAC_FORBIDDEN_WARNING } from "./constants";
import type { MsgfGuardSettings } from "./config";
import type { PulseFlushContext } from "./devSessionPulse";
import { buildPulseAuthHeaders } from "./pulseAuth";
import { handlePulseResponseViolations } from "./pulseViolationAlert";
import { telemetryToKeystrokes } from "./keystrokeCapture";
import type { TelemetryChangeEvent } from "./telemetryTypes";

const LOG_PREFIX = "[MSGF Guard]";

export type PulseFlushResult = {
  ok: boolean;
  /** Cloud Run returned 403 — caller should pause the buffer and warn the user. */
  forbidden?: boolean;
  snapshot: IdeStatusBarSnapshot;
};

function emptySnapshot(
  routing: IdeStatusBarSnapshot["routing"],
  error?: string
): IdeStatusBarSnapshot {
  return {
    logicDriftScore: null,
    logicDriftLabel: "—",
    escalationThreshold: null,
    routing,
    defendTier: null,
    baselineRequired: false,
    humanTiebreakerRequired: false,
    bufferedEventCount: 0,
    updatedAt: Date.now(),
    error,
  };
}

function scoreToLabel(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function snapshotFromPulseBody(raw: Record<string, unknown>): IdeStatusBarSnapshot {
  const glass =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : null;

  const logicDriftScore =
    typeof glass?.driftScore === "number" && Number.isFinite(glass.driftScore)
      ? glass.driftScore
      : typeof raw.logic_drift_score === "number" && Number.isFinite(raw.logic_drift_score)
        ? raw.logic_drift_score
        : null;

  let routing: IdeStatusBarSnapshot["routing"] = "global";
  if (raw.baseline_required === true) routing = "baseline_required";
  else if (raw.routing === "local_gateway") routing = "local_gateway";

  const tierRaw =
    glass?.pillarStatus && typeof glass.pillarStatus === "object"
      ? (glass.pillarStatus as Record<string, unknown>).preflightTier
      : raw.defend_preflight_tier;
  const defendTier =
    tierRaw === "GREEN" || tierRaw === "YELLOW" || tierRaw === "RED" ? tierRaw : null;

  return {
    logicDriftScore,
    logicDriftLabel: scoreToLabel(logicDriftScore),
    escalationThreshold:
      typeof raw.logic_drift_escalation_threshold === "number"
        ? raw.logic_drift_escalation_threshold
        : null,
    routing,
    defendTier,
    baselineRequired: raw.baseline_required === true,
    humanTiebreakerRequired: raw.human_tiebreaker_required === true,
    bufferedEventCount: 0,
    updatedAt: Date.now(),
  };
}

/**
 * POST batched telemetry to MSGF Pulse (non-blocking; errors are isolated).
 */
export async function flushTelemetryBatch(params: {
  settings: MsgfGuardSettings;
  tenantId: string;
  entityId: string;
  batch: TelemetryChangeEvent[];
  flushContext?: PulseFlushContext;
  fetchImpl?: typeof fetch;
}): Promise<PulseFlushResult> {
  const keystrokes = telemetryToKeystrokes(params.batch);
  if (!keystrokes.length) {
    return { ok: true, snapshot: emptySnapshot("idle") };
  }

  const baseUrl = params.settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/pulse`;
  const fetchFn = params.fetchImpl ?? fetch.bind(globalThis);

  const headers = buildPulseAuthHeaders({
    settings: params.settings,
    tenantId: params.tenantId,
    entityId: params.entityId,
    flushContext: params.flushContext,
  });

  if (!headers.Authorization) {
    return {
      ok: false,
      snapshot: emptySnapshot("error", "msgf.authToken is required for Pulse."),
    };
  }

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ keystrokes }),
    });

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 403) {
      console.warn(`${LOG_PREFIX} RBAC 403:`, raw.error ?? MSGF_RBAC_FORBIDDEN_WARNING);
      return {
        ok: false,
        forbidden: true,
        snapshot: emptySnapshot("error", MSGF_RBAC_FORBIDDEN_WARNING),
      };
    }

    if (!res.ok) {
      const c = classifyHttpError({ status: res.status, body: raw });
      console.warn(`${LOG_PREFIX} flush failed [${c.code}]:`, c.message);
      return {
        ok: false,
        snapshot: emptySnapshot("error", `[${c.code}] ${c.message}`),
      };
    }

    handlePulseResponseViolations(raw);

    return {
      ok: raw.ok !== false,
      snapshot: snapshotFromPulseBody(raw),
    };
  } catch (e) {
    const net = e instanceof Error ? e.message : "Pulse network error";
    const c = classifyHttpError({ networkMessage: net });
    console.warn(`${LOG_PREFIX} flush network error [${c.code}] (editor not blocked):`, net);
    return {
      ok: false,
      snapshot: emptySnapshot("error", `[${c.code}] ${c.message}`),
    };
  }
}
