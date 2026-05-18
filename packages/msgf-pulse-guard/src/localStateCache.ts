import * as fs from "node:fs";

import type { MsgfGuardSettings } from "./config";
import type { TelemetryChangeEvent } from "./telemetryTypes";
import {
  getLocalStateCachePath,
  getWorkspaceRoot,
} from "./workspace/msgfWorkspace";

export type MsgfGovernancePillarId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export type PillarCacheSlice = {
  updatedAt: string;
  eventCount: number;
  lastPath?: string;
  lastUri?: string;
  samples: unknown[];
};

export type LocalStateCacheManifest = {
  version: 1;
  updatedAt: string;
  tenantKey: string;
  entityId: string;
  smallBrain: {
    provider: string;
    modelName: string;
  };
  pillars: Record<MsgfGovernancePillarId, PillarCacheSlice>;
};

const MAX_SAMPLES_PER_PILLAR = 48;

function emptyPillars(): Record<MsgfGovernancePillarId, PillarCacheSlice> {
  const now = new Date().toISOString();
  const base = (): PillarCacheSlice => ({
    updatedAt: now,
    eventCount: 0,
    samples: [],
  });
  return {
    P1: base(),
    P2: base(),
    P3: base(),
    P4: base(),
    P5: base(),
    P6: base(),
  };
}

function loadManifest(filePath: string): LocalStateCacheManifest | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as LocalStateCacheManifest;
    if (raw?.version !== 1 || !raw.pillars) return null;
    return raw;
  } catch {
    return null;
  }
}

function pushSample(slice: PillarCacheSlice, sample: unknown): void {
  slice.samples.push(sample);
  if (slice.samples.length > MAX_SAMPLES_PER_PILLAR) {
    slice.samples = slice.samples.slice(-MAX_SAMPLES_PER_PILLAR);
  }
  slice.eventCount += 1;
  slice.updatedAt = new Date().toISOString();
}

function isSecurityPath(workspacePath: string): boolean {
  return /\.(env|pem|key|secret)|auth|credential|token/i.test(workspacePath);
}

function isRoadmapPath(workspacePath: string): boolean {
  return /roadmap|p2|flow|milestone/i.test(workspacePath);
}

/**
 * Map editor telemetry into the six governance pillars for local Small Brain / gateway cache.
 */
export function mapTelemetryToPillars(
  events: TelemetryChangeEvent[]
): Partial<Record<MsgfGovernancePillarId, unknown[]>> {
  const mapped: Partial<Record<MsgfGovernancePillarId, unknown[]>> = {};

  for (const ev of events) {
    mapped.P4 = mapped.P4 ?? [];
    mapped.P4.push({
      tsMs: ev.tsMs,
      netDelta: ev.netDelta,
      paste: ev.isLikelyPaste,
      target: ev.workspacePath,
    });

    mapped.P5 = mapped.P5 ?? [];
    mapped.P5.push({
      tsMs: ev.tsMs,
      path: ev.workspacePath,
      workspace: ev.workspaceName,
      uri: ev.documentUri,
    });

    mapped.P1 = mapped.P1 ?? [];
    mapped.P1.push({
      tsMs: ev.tsMs,
      rhythm: ev.isLikelyPaste ? "paste" : "keystroke",
      delta: ev.netDelta,
    });

    if (isRoadmapPath(ev.workspacePath)) {
      mapped.P2 = mapped.P2 ?? [];
      mapped.P2.push({ tsMs: ev.tsMs, path: ev.workspacePath, kind: "roadmap_surface" });
    }

    if (isSecurityPath(ev.workspacePath)) {
      mapped.P3 = mapped.P3 ?? [];
      mapped.P3.push({ tsMs: ev.tsMs, path: ev.workspacePath, kind: "security_surface" });
    }

    if (ev.isLikelyPaste || ev.netDelta > 120) {
      mapped.P6 = mapped.P6 ?? [];
      mapped.P6.push({
        tsMs: ev.tsMs,
        path: ev.workspacePath,
        flag: "constraint_review",
        netDelta: ev.netDelta,
      });
    }
  }

  return mapped;
}

export class LocalStateCacheWriter {
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents: TelemetryChangeEvent[] = [];

  constructor(
    private readonly tenantKey: string,
    private readonly entityId: string,
    private readonly settings: MsgfGuardSettings
  ) {}

  dispose(): void {
    if (this.writeTimer != null) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.pendingEvents = [];
  }

  /** Queue document changes; debounced flush to `.msgf/local_state_cache.json`. */
  recordDocumentChanges(events: TelemetryChangeEvent[]): void {
    if (!events.length) return;
    this.pendingEvents.push(...events);

    if (this.writeTimer != null) {
      clearTimeout(this.writeTimer);
    }
    this.writeTimer = setTimeout(() => {
      this.flushPending();
    }, 400);
  }

  flushPending(): LocalStateCacheManifest | null {
    const root = getWorkspaceRoot();
    if (!root || !this.pendingEvents.length) return null;

    const filePath = getLocalStateCachePath(root);
    const existing = loadManifest(filePath);
    const pillars = existing?.pillars ?? emptyPillars();

    const mapped = mapTelemetryToPillars(this.pendingEvents);
    for (const pillar of Object.keys(mapped) as MsgfGovernancePillarId[]) {
      const samples = mapped[pillar] ?? [];
      const slice = pillars[pillar];
      for (const sample of samples) {
        pushSample(slice, sample);
      }
      const lastEv = this.pendingEvents[this.pendingEvents.length - 1];
      slice.lastPath = lastEv.workspacePath;
      slice.lastUri = lastEv.documentUri;
    }

    const manifest: LocalStateCacheManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      tenantKey: this.tenantKey,
      entityId: this.entityId,
      smallBrain: {
        provider: this.settings.smallBrainProvider,
        modelName: this.settings.smallBrainModelName,
      },
      pillars,
    };

    try {
      fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    } catch (e) {
      console.warn("[MSGF Guard] local_state_cache write failed:", e);
    }

    this.pendingEvents = [];
    this.writeTimer = null;
    return manifest;
  }

  readManifest(): LocalStateCacheManifest | null {
    const root = getWorkspaceRoot();
    if (!root) return null;
    return loadManifest(getLocalStateCachePath(root));
  }
}
