/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * Headless MSGF connector for IDE extensions — buffered Pulses + status-bar logic drift.
 *
 * Identity: `tenantId` = repo / workspace name, `entityId` = developer machine id.
 * Uses contract license + {@link MSGF_IDE_PULSE_HEADER} (no browser session).
 */

import { throwForMsgfPulseResponse } from "@/lib/connector/error-mapper";
import { toPulseRequestBody, type P1Standard } from "@/lib/connector/p1-standard";
import type { UniversalP1KeystrokeEvent } from "@/src/lib/universal/p1HalStandard";
import {
  MSGF_BRAIN_SENSITIVITY_HEADER,
  resolveBrainSensitivityHeader,
} from "@/lib/connector/brain-sensitivity";
import { normalizeConnectorTenantId } from "@/lib/connector/tenant";
import {
  MSGF_ACTIVE_FILE_HEADER,
  MSGF_BUILD_ACTIVE_HEADER,
  MSGF_DEV_SESSION_HEADER,
  MSGF_ENTITY_ID_HEADER,
  MSGF_FLUSH_REASON_HEADER,
  MSGF_IDE_PULSE_HEADER,
  MSGF_TENANT_ID_HEADER,
} from "@/lib/msgf-http-headers";
import {
  defaultIdeConnectorDevSession,
  type IdeFlushReason,
} from "@/lib/services/dev-session-profile";
import { licenseBearerHeaders } from "@/lib/connector/bearer-auth";
import { assertTenantId } from "@/lib/errors/sovereign-violation";

export type IdePulseBufferOptions = {
  /** Idle time before flushing buffered keystrokes (default 1200 ms). */
  debounceMs?: number;
  /** Flush immediately when buffer reaches this size (default 96). */
  maxBufferedEvents?: number;
  /** Minimum events required before a debounced flush (default 1). */
  minEventsToFlush?: number;
  /**
   * Dev session: debounce for unsaved typing; use {@link IdeConnector.notifyFileSaved} for primary flush.
   * Default follows `MSGF_DEV_SESSION_DEFAULT` when omitted.
   */
  devSession?: boolean;
};

export type IdeConnectorConfig = {
  /** Repo / workspace silo — sent as {@link MSGF_TENANT_ID_HEADER}. */
  tenantId: string;
  /** Developer local id — sent as {@link MSGF_ENTITY_ID_HEADER}. */
  entityId: string;
  baseUrl?: string;
  licenseKey?: string;
  fetchImpl?: typeof fetch;
  /** Brain sensitivity 0.1 (strict) → 0.5 (relaxed). */
  brainSensitivity?: number;
  buffer?: IdePulseBufferOptions;
  /** Enable dev session profile (save-primary flush + build-active headers). */
  devSession?: boolean;
};

export type IdeStatusRouting =
  | "idle"
  | "buffering"
  | "pending"
  | "local_gateway"
  | "global"
  | "baseline_required"
  | "error";

/** Snapshot for IDE status bar rendering. */
export type IdeStatusBarSnapshot = {
  logicDriftScore: number | null;
  /** 0–100 display string derived from score (e.g. `"32%"`). */
  logicDriftLabel: string;
  escalationThreshold: number | null;
  routing: IdeStatusRouting;
  defendTier: "GREEN" | "YELLOW" | "RED" | null;
  baselineRequired: boolean;
  humanTiebreakerRequired: boolean;
  bufferedEventCount: number;
  updatedAt: number | null;
  error?: string;
};

export type IdeBufferedPulseResult = IdeStatusBarSnapshot & {
  ok: boolean;
  raw: Record<string, unknown>;
};

const DEFAULT_BUFFER: Required<IdePulseBufferOptions> = {
  debounceMs: 1200,
  maxBufferedEvents: 96,
  minEventsToFlush: 1,
  devSession: false,
};

function emptyStatus(
  routing: IdeStatusRouting,
  bufferedEventCount: number,
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
    bufferedEventCount,
    updatedAt: null,
    error,
  };
}

function scoreToLabel(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function parseDefendTier(raw: Record<string, unknown>): "GREEN" | "YELLOW" | "RED" | null {
  const tier = raw.defend_preflight_tier ?? raw.preflight_tier;
  if (tier === "GREEN" || tier === "YELLOW" || tier === "RED") return tier;
  return null;
}

function coerceGlassDefendTier(value: string | null): "GREEN" | "YELLOW" | "RED" | null {
  return value === "GREEN" || value === "YELLOW" || value === "RED" ? value : null;
}

function snapshotFromPulseBody(
  raw: Record<string, unknown>,
  bufferedEventCount: number
): IdeStatusBarSnapshot {
  const glass =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : null;
  const driftFromGlass =
    typeof glass?.driftScore === "number" && Number.isFinite(glass.driftScore)
      ? glass.driftScore
      : null;

  const logicDriftScore =
    driftFromGlass ??
    (typeof raw.logic_drift_score === "number" && Number.isFinite(raw.logic_drift_score)
      ? raw.logic_drift_score
      : null);

  const escalationThreshold =
    typeof raw.logic_drift_escalation_threshold === "number"
      ? raw.logic_drift_escalation_threshold
      : null;

  let routing: IdeStatusRouting = "global";
  if (raw.baseline_required === true) {
    routing = "baseline_required";
  } else if (raw.routing === "local_gateway") {
    routing = "local_gateway";
  } else if (raw.ok === true) {
    routing = "global";
  }

  const pillar =
    glass?.pillarStatus && typeof glass.pillarStatus === "object"
      ? (glass.pillarStatus as Record<string, unknown>)
      : null;
  const tierFromGlassRaw =
    typeof pillar?.preflightTier === "string" ? pillar.preflightTier : null;
  const defendTier =
    coerceGlassDefendTier(tierFromGlassRaw) ?? parseDefendTier(raw);

  const humanTbFromGlass =
    typeof pillar?.humanTiebreakerRequired === "boolean"
      ? pillar.humanTiebreakerRequired
      : raw.human_tiebreaker_required === true;

  return {
    logicDriftScore,
    logicDriftLabel: scoreToLabel(logicDriftScore),
    escalationThreshold,
    routing,
    defendTier,
    baselineRequired: raw.baseline_required === true,
    humanTiebreakerRequired: humanTbFromGlass,
    bufferedEventCount,
    updatedAt: Date.now(),
  };
}

/**
 * Lightweight headless bridge for IDE extensions (buffered keystrokes → MSGF Pulse).
 */
export class IdeConnector {
  readonly tenantId: string;
  readonly entityId: string;

  private readonly licenseKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly brainSensitivity: number | undefined;
  private readonly bufferOpts: Required<IdePulseBufferOptions> & { devSession: boolean };
  private readonly devSessionEnabled: boolean;

  private readonly events: UniversalP1KeystrokeEvent[] = [];
  private activeFilePath: string | null = null;
  private buildActive = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<IdeBufferedPulseResult> | null = null;
  private pendingFlush = false;
  private disposed = false;
  private lastStatus: IdeStatusBarSnapshot = emptyStatus("idle", 0);

  constructor(config: IdeConnectorConfig) {
    assertTenantId(config.tenantId, "IdeConnector");
    const entityId = config.entityId?.trim();
    if (!entityId) throw new Error("IdeConnector: entityId (developer id) is required.");
    const tenantId = config.tenantId.trim();

    const key =
      config.licenseKey?.trim() ||
      process.env.MSGF_CONTRACT_LICENSE_KEY?.trim() ||
      "";
    const base =
      config.baseUrl?.trim().replace(/\/$/, "") ||
      process.env.MSGF_APP_URL?.trim().replace(/\/$/, "") ||
      "";

    if (!key.startsWith("msgf_live_")) {
      throw new Error(
        "IdeConnector: licenseKey is required (config or MSGF_CONTRACT_LICENSE_KEY)."
      );
    }
    if (!base) {
      throw new Error("IdeConnector: baseUrl is required (config or MSGF_APP_URL).");
    }

    this.tenantId = normalizeConnectorTenantId(tenantId);
    this.entityId = entityId;
    this.licenseKey = key;
    this.baseUrl = base;
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.brainSensitivity =
      config.brainSensitivity != null
        ? resolveBrainSensitivityHeader(config.brainSensitivity)
        : undefined;
    const devSession =
      config.devSession ??
      config.buffer?.devSession ??
      defaultIdeConnectorDevSession();
    this.devSessionEnabled = devSession;
    this.bufferOpts = { ...DEFAULT_BUFFER, ...config.buffer, devSession };
  }

  /** Workspace-relative path for P5 vault shard boost + lineage cache scope. */
  setActiveFile(path: string | null): void {
    const p = path?.trim().replace(/\\/g, "/");
    this.activeFilePath = p ? p.slice(0, 512) : null;
  }

  /** While true, pulses include build-active header (relaxed logic drift). */
  setBuildActive(active: boolean): void {
    this.buildActive = active;
  }

  getBuildActive(): boolean {
    return this.buildActive;
  }

  /**
   * Primary flush for dev session — call on editor save / file close.
   */
  notifyFileSaved(): Promise<IdeBufferedPulseResult> {
    return this.flush("save");
  }

  /** Flush after build/test completes (optional). */
  notifyBuildEnded(): Promise<IdeBufferedPulseResult> {
    this.buildActive = false;
    return this.flush("build_end");
  }

  /**
   * POST structured build failure (no keystroke / biometric pipeline).
   * Requires `MSGF_CONTRACT_LICENSE_KEY` or config license on connector.
   */
  async postBuildFailedEvent(params: {
    excerpt: string;
    exitCode: number;
    activeFile?: string;
  }): Promise<{ ok: boolean; raw: Record<string, unknown> }> {
    const url = `${this.baseUrl}/api/msgf/dev-event`;
    const activeFile = (params.activeFile ?? this.activeFilePath ?? "build.log").replace(/\\/g, "/");
    const body = {
      kind: "build_failed" as const,
      activeFile,
      excerpt: params.excerpt.slice(0, 12_000),
      exitCode: params.exitCode,
      tenantId: this.tenantId,
    };

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...licenseBearerHeaders(this.licenseKey, {
          [MSGF_ENTITY_ID_HEADER]: this.entityId,
          [MSGF_TENANT_ID_HEADER]: this.tenantId,
          ...(this.devSessionEnabled ? { [MSGF_DEV_SESSION_HEADER]: "1" } : {}),
        }),
      },
      body: JSON.stringify(body),
    });

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && raw.ok !== false, raw };
  }

  /** Latest status-bar snapshot (updated after each successful flush). */
  getStatus(): IdeStatusBarSnapshot {
    return {
      ...this.lastStatus,
      bufferedEventCount: this.events.length,
      routing:
        this.inFlight != null
          ? "pending"
          : this.events.length > 0
            ? "buffering"
            : this.lastStatus.routing,
    };
  }

  /** Queue one keystroke; debounced flush calls the Pulse API. */
  pushKeystroke(event: UniversalP1KeystrokeEvent): void {
    if (this.disposed) return;
    this.events.push(event);
    this.lastStatus = {
      ...this.lastStatus,
      routing: "buffering",
      bufferedEventCount: this.events.length,
    };

    if (this.events.length >= this.bufferOpts.maxBufferedEvents) {
      void this.flush(this.devSessionEnabled ? "debounce" : undefined);
      return;
    }

    if (!this.devSessionEnabled || this.bufferOpts.debounceMs > 0) {
      this.scheduleDebouncedFlush();
    }
  }

  pushKeystrokes(events: UniversalP1KeystrokeEvent[]): void {
    for (const e of events) this.pushKeystroke(e);
  }

  private scheduleDebouncedFlush(): void {
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush(this.devSessionEnabled ? "debounce" : undefined);
    }, this.bufferOpts.debounceMs);
  }

  /**
   * Sends buffered keystrokes to `POST /api/msgf/pulse` and returns logic drift for the status bar.
   */
  async flush(reason?: IdeFlushReason): Promise<IdeBufferedPulseResult> {
    assertTenantId(this.tenantId, "IdeConnector.flush");
    if (this.disposed) {
      return {
        ...emptyStatus("error", 0, "IdeConnector disposed."),
        ok: false,
        raw: {},
      };
    }

    if (this.inFlight) {
      this.pendingFlush = true;
      return this.inFlight;
    }

    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const batch = this.events.splice(0, this.events.length);
    if (batch.length < this.bufferOpts.minEventsToFlush) {
      const idle = emptyStatus("idle", 0);
      this.lastStatus = idle;
      return { ...idle, ok: true, raw: {} };
    }

    this.lastStatus = emptyStatus("pending", 0);

    this.inFlight = this.dispatchBuffered(batch, reason ?? (this.devSessionEnabled ? "debounce" : "manual"))
      .then((result) => {
        this.lastStatus = result;
        return result;
      })
      .finally(() => {
        this.inFlight = null;
        if (this.pendingFlush && !this.disposed && this.events.length > 0) {
          this.pendingFlush = false;
          void this.flush();
        } else {
          this.pendingFlush = false;
        }
      });

    return this.inFlight;
  }

  private async dispatchBuffered(
    keystrokes: UniversalP1KeystrokeEvent[],
    flushReason: IdeFlushReason
  ): Promise<IdeBufferedPulseResult> {
    const url = `${this.baseUrl}/api/msgf/pulse`;
    const payload: P1Standard = {
      keystrokes,
      ...(this.brainSensitivity != null
        ? { brainSensitivity: this.brainSensitivity }
        : {}),
    };
    const body = toPulseRequestBody(payload);
    const sensitivityHeader =
      this.brainSensitivity != null ? String(this.brainSensitivity) : undefined;

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...licenseBearerHeaders(this.licenseKey, {
            [MSGF_IDE_PULSE_HEADER]: "1",
            [MSGF_ENTITY_ID_HEADER]: this.entityId,
            [MSGF_TENANT_ID_HEADER]: this.tenantId,
            ...(this.devSessionEnabled
              ? {
                  [MSGF_DEV_SESSION_HEADER]: "1",
                  [MSGF_FLUSH_REASON_HEADER]: flushReason,
                  ...(this.buildActive ? { [MSGF_BUILD_ACTIVE_HEADER]: "1" } : {}),
                  ...(this.activeFilePath
                    ? {
                        [MSGF_ACTIVE_FILE_HEADER]: encodeURIComponent(this.activeFilePath),
                      }
                    : {}),
                }
              : {}),
            ...(sensitivityHeader
              ? { [MSGF_BRAIN_SENSITIVITY_HEADER]: sensitivityHeader }
              : {}),
          }),
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "IDE Pulse network error.";
      const errSnap = {
        ...emptyStatus("error", 0, message),
        ok: false,
        raw: {},
      };
      return errSnap;
    }

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      try {
        throwForMsgfPulseResponse(res.status, raw);
      } catch (e) {
        const message = e instanceof Error ? e.message : `Pulse failed (${res.status}).`;
        return {
          ...emptyStatus("error", 0, message),
          ok: false,
          raw,
        };
      }
    }

    const snapshot = snapshotFromPulseBody(raw, 0);
    return {
      ...snapshot,
      ok: raw.ok !== false,
      raw,
    };
  }

  /** Cancel timers and drop buffered events. */
  dispose(): void {
    this.disposed = true;
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.events.length = 0;
    this.lastStatus = emptyStatus("idle", 0);
  }
}

/**
 * Factory aligned with {@link MsgfClient} naming — repo silo + developer entity.
 */
export function createIdeConnector(config: IdeConnectorConfig): IdeConnector {
  return new IdeConnector(config);
}
