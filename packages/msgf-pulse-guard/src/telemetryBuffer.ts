import type { MsgfGuardSettings } from "./config";
import type { IdeFlushReason, PulseFlushContext } from "./devSessionPulse";
import { isSavePrimaryPulseMode } from "./devSessionPulse";
import { LocalStateCacheWriter } from "./localStateCache";
import { TELEMETRY_FLUSH_INTERVAL_MS } from "./constants";
import { flushTelemetryBatch, type PulseFlushResult } from "./pulseFlush";
import type { TelemetryChangeEvent } from "./telemetryTypes";

const LOG_PREFIX = "[MSGF Guard]";

export type TelemetryBufferOptions = {
  settings: MsgfGuardSettings;
  tenantId: string;
  entityId: string;
  localCache?: LocalStateCacheWriter | null;
  onFlushComplete: (result: PulseFlushResult, pendingCount: number) => void;
  onRbacForbidden?: () => void;
  fetchImpl?: typeof fetch;
};

/**
 * Rolling buffer — production: 3s micro-batch flush; dev session: save + manual only.
 */
export class TelemetryBuffer {
  private readonly buffer: TelemetryChangeEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private disposed = false;
  private paused = false;
  private buildActive = false;
  private readonly savePrimary: boolean;

  constructor(private readonly options: TelemetryBufferOptions) {
    this.savePrimary = isSavePrimaryPulseMode(options.settings);
  }

  start(): void {
    this.paused = false;
    if (!this.savePrimary) {
      this.flushTimer = setInterval(() => {
        void this.flush("debounce");
      }, TELEMETRY_FLUSH_INTERVAL_MS);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.pauseStream();
    this.buffer.length = 0;
  }

  /** Stops the background flush interval (RBAC 403 or manual halt). */
  pauseStream(): void {
    this.paused = true;
    if (this.flushTimer != null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isSavePrimary(): boolean {
    return this.savePrimary;
  }

  setBuildActive(active: boolean): void {
    this.buildActive = active;
  }

  push(events: TelemetryChangeEvent[]): void {
    if (this.disposed || this.paused || !events.length) return;
    this.buffer.push(...events);
  }

  get pendingCount(): number {
    return this.buffer.length;
  }

  /** Force flush (save, command palette, or production debounce tick). */
  async flushNow(
    reason: IdeFlushReason = "manual",
    activeFilePath?: string | null
  ): Promise<PulseFlushResult> {
    return this.flush(reason, activeFilePath);
  }

  private flushContext(
    reason: IdeFlushReason,
    activeFilePath?: string | null
  ): PulseFlushContext {
    return {
      devSession: this.savePrimary,
      flushReason: reason,
      activeFilePath: activeFilePath ?? null,
      buildActive: this.buildActive,
    };
  }

  private async flush(
    reason: IdeFlushReason = "debounce",
    activeFilePath?: string | null
  ): Promise<PulseFlushResult> {
    if (this.disposed || this.paused || this.inFlight || this.buffer.length === 0) {
      return {
        ok: true,
        snapshot: {
          logicDriftScore: null,
          logicDriftLabel: "—",
          escalationThreshold: null,
          routing: this.paused ? "error" : "idle",
          defendTier: null,
          baselineRequired: false,
          humanTiebreakerRequired: false,
          bufferedEventCount: this.buffer.length,
          updatedAt: Date.now(),
        },
      };
    }

    const batch = this.buffer.splice(0, this.buffer.length);
    this.inFlight = true;

    try {
      this.options.localCache?.flushPending();

      const result = await flushTelemetryBatch({
        settings: this.options.settings,
        tenantId: this.options.tenantId,
        entityId: this.options.entityId,
        batch,
        flushContext: this.flushContext(reason, activeFilePath),
        fetchImpl: this.options.fetchImpl,
      });

      if (result.forbidden) {
        this.buffer.unshift(...batch);
        this.pauseStream();
        this.options.onRbacForbidden?.();
      }

      this.options.onFlushComplete(result, this.buffer.length);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`${LOG_PREFIX} unexpected flush error:`, message);
      const fail: PulseFlushResult = {
        ok: false,
        snapshot: {
          logicDriftScore: null,
          logicDriftLabel: "—",
          escalationThreshold: null,
          routing: "error",
          defendTier: null,
          baselineRequired: false,
          humanTiebreakerRequired: false,
          bufferedEventCount: this.buffer.length,
          updatedAt: Date.now(),
          error: message,
        },
      };
      this.options.onFlushComplete(fail, this.buffer.length);
      return fail;
    } finally {
      this.inFlight = false;
    }
  }
}
