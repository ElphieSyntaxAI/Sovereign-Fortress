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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/**
 * P4 State Ledger controller — hot Redis active slice + cold `state_beats` verification.
 * Accepts Syntax Education "The Call" telemetry and legacy MSGF keystroke envelopes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  StateLedgerP4,
  chunkKeystrokeStream,
  type FlowVerifyResult,
  type KeystrokeChunk,
  type KeystrokeEvent,
  type P4LedgerDomain,
  type StateBeatRow,
} from "@/lib/P4";
import {
  breakdownIndexForFlowInconsistency,
  breakdownIndexForPasteAnomaly,
} from "@/lib/education/learning-breakdown-index";
import {
  TheCallIngestBodySchema,
  isEducationTenantId,
  normalizeTheCallToKeystrokes,
  resolveEcosystemSource,
  resolveTelemetryMode,
  type CellMutationEvent,
  type EcosystemSource,
  type FocusEvent,
  type TelemetryMode,
  type TheCallIngestBody,
} from "@/lib/education/the-call-telemetry";
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { getActiveSlice, setActiveSlice } from "@/lib/msgf-hot-layer";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

export type P4StateLedgerIngestInput = {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  rawBody: unknown;
  /** Optional retry count from prior pulse/HITL (hot layer). */
  previousRetryCount?: number;
};

export type P4StateLedgerIngestResult = {
  domain: P4LedgerDomain;
  eventCount: number;
  chunks: KeystrokeChunk[];
  verifyResults: FlowVerifyResult[];
  previousBeats: StateBeatRow[];
  hotLayerHit: boolean;
  /** Suggested 1.1.1 paths for P6 cold persistence (learning breakdown vs bug). */
  suggestedBreakdowns: GenealogicalBugIndex[];
  assignmentId?: string;
  subjectDomain?: string;
  /** Pillars §2.4.1 — host environment tag. */
  ecosystemSource: EcosystemSource;
  /** Pillars §2.4.1 — Human Effort Score surrogate mode actually used. */
  telemetryMode: TelemetryMode;
  /** Focus pause / resume beats appended this ingest cycle (pillars §3.2). */
  focusBeatsAppended: number;
  /** Cell-mutation events processed (Sheets / Excel surrogate). */
  cellMutationCount: number;
};

function detectPasteWithoutKeys(events: KeystrokeEvent[]): boolean {
  return events.some(
    (e) =>
      e.isSystemEvent === true &&
      (e.key === "PASTE_EVENT" || e.key.toUpperCase().includes("PASTE")) &&
      (e.wordsPasted ?? 0) > 0
  );
}

function detectCellMutationPasteAnomaly(events: CellMutationEvent[]): boolean {
  // Heuristic: any explicit paste or any single mutation inserting > 80 chars.
  return events.some(
    (m) => m.isPaste === true || (m.deltaChars != null && m.deltaChars > 80)
  );
}

function resolveLedgerDomain(tenantId: string): P4LedgerDomain {
  return isEducationTenantId(tenantId) ? "education" : "author";
}

function toEpochMs(ts: string | number): number {
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  const parsed = Date.parse(String(ts));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/**
 * Convert cell-mutation events into pseudo-keystroke rows so existing HAL chunking +
 * flow verification continue to work for Sheets / Excel hosts that cannot emit raw keys.
 * Pillars §2.4.1 — "Cell-Mutation Velocity" surrogate for Human Effort Score.
 */
function cellMutationsToKeystrokes(
  mutations: CellMutationEvent[],
  baseTarget: string
): KeystrokeEvent[] {
  return mutations.map((m) => ({
    ts: toEpochMs(m.ts),
    key: m.isPaste ? "PASTE_EVENT" : `CELL_MUTATION:${m.cellRef}`,
    type: "input" as const,
    target: `${baseTarget} cell=${m.cellRef}`,
    isSystemEvent: true,
    wordsPasted: m.isPaste ? Math.max(0, Math.round((m.deltaChars ?? 0) / 5)) : undefined,
  }));
}

/**
 * Ingest student/author keystroke telemetry into P4:
 * 1. Normalize "The Call" payload → {@link KeystrokeEvent}[]
 * 2. Redis hot active slice (`setActiveSlice` — unchanged)
 * 3. Chunk + verify against `state_beats` (cold layer read — unchanged)
 */
export async function ingestP4StateLedgerTelemetry(
  input: P4StateLedgerIngestInput
): Promise<P4StateLedgerIngestResult> {
  const parsed = TheCallIngestBodySchema.parse(input.rawBody);
  const domain = resolveLedgerDomain(input.tenantId);
  const ecosystemSource = resolveEcosystemSource(parsed);
  const telemetryMode = resolveTelemetryMode(parsed);

  const keystrokeEvents = normalizeTheCallToKeystrokes(parsed);
  const cellMutations = parsed.cellMutations ?? [];
  const focusEvents = parsed.focusEvents ?? [];

  const cellMutationTargetTag = [
    `edu:${parsed.subjectDomain ?? "general"}`,
    `ecosystem=${ecosystemSource}`,
    `mode=${telemetryMode}`,
    parsed.assignmentId ? `assignment=${parsed.assignmentId}` : null,
    parsed.sessionId ? `session=${parsed.sessionId}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const events: KeystrokeEvent[] = [
    ...keystrokeEvents,
    ...cellMutationsToKeystrokes(cellMutations, cellMutationTargetTag),
  ];

  const p4 = new StateLedgerP4(input.supabase, input.tenantId, domain);

  const cached = await getActiveSlice(input.entityId);
  let previousBeats: StateBeatRow[];
  let hotLayerHit: boolean;
  let previousRetryCount: number;

  if (cached && cached.entityId === input.entityId) {
    previousBeats = cached.previousBeats;
    previousRetryCount = cached.previousRetryCount;
    hotLayerHit = true;
  } else {
    previousBeats = await p4.fetchPreviousBeats(input.entityId);
    previousRetryCount = input.previousRetryCount ?? 0;
    hotLayerHit = false;
  }

  const { chunks, results: verifyResults } =
    events.length > 0
      ? await p4.verifyKeystrokeStream(input.entityId, events)
      : { chunks: [] as KeystrokeChunk[], results: [] as FlowVerifyResult[] };

  await setActiveSlice({
    entityId: input.entityId,
    previousBeats,
    previousRetryCount,
  });

  const focusBeatsAppended = await persistFocusBeats({
    supabase: input.supabase,
    tenantId: input.tenantId,
    entityId: input.entityId,
    focusEvents,
    ecosystemSource,
    telemetryMode,
    assignmentId: parsed.assignmentId,
    sessionId: parsed.sessionId,
  });

  const suggestedBreakdowns: GenealogicalBugIndex[] = [];
  if (detectPasteWithoutKeys(events) || detectCellMutationPasteAnomaly(cellMutations)) {
    suggestedBreakdowns.push(breakdownIndexForPasteAnomaly());
  }
  if (verifyResults.some((r) => !r.consistent)) {
    suggestedBreakdowns.push(breakdownIndexForFlowInconsistency());
  }

  return {
    domain,
    eventCount: events.length,
    chunks,
    verifyResults,
    previousBeats,
    hotLayerHit,
    suggestedBreakdowns,
    assignmentId: parsed.assignmentId,
    subjectDomain: parsed.subjectDomain,
    ecosystemSource,
    telemetryMode,
    focusBeatsAppended,
    cellMutationCount: cellMutations.length,
  };
}

/**
 * Pillars §3.2 — active session focus monitor.
 * Persists each `focus_pause` / `focus_resume` event as a P4 `state_beats` row tagged
 * with the originating `ecosystem_source` + `telemetry_mode` so teacher dashboards can
 * render concentration vs. distraction zones.
 */
async function persistFocusBeats(params: {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  focusEvents: FocusEvent[];
  ecosystemSource: EcosystemSource;
  telemetryMode: TelemetryMode;
  assignmentId?: string;
  sessionId?: string;
}): Promise<number> {
  if (params.focusEvents.length === 0) return 0;

  let appended = 0;
  for (const fe of params.focusEvents) {
    const ts = toEpochMs(fe.ts);
    const beatText =
      fe.type === "focus_pause"
        ? `Active-time tracker paused (${fe.reason ?? "tab_hidden"})`
        : `Active-time tracker resumed (${fe.reason ?? "tab_focus"})`;
    try {
      await appendP4InstructionalBeat({
        supabase: params.supabase,
        tenantId: params.tenantId,
        entityId: params.entityId,
        beatText,
        label: fe.type,
        metadata: {
          pillar_extension: "P4_2_4_1",
          ecosystem_source: params.ecosystemSource,
          telemetry_mode: params.telemetryMode,
          surface: fe.surface,
          reason: fe.reason,
          assignment_id: params.assignmentId,
          session_id: params.sessionId,
          focus_event_ts: ts,
        },
      });
      appended += 1;
    } catch {
      // Fail-open: focus beats are best-effort observability and must not block ingest.
    }
  }
  return appended;
}

/**
 * Append an instructional milestone beat after a verified chunk (cold `state_beats`).
 */
export async function appendP4InstructionalBeat(params: {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  beatText: string;
  label?: string;
  metadata?: Record<string, unknown>;
}): Promise<StateBeatRow> {
  const domain = resolveLedgerDomain(params.tenantId);
  const p4 = new StateLedgerP4(params.supabase, params.tenantId, domain);
  return p4.appendBeat(params.entityId, params.beatText, {
    label: params.label,
    metadata: params.metadata,
    legalVersion: CURRENT_LEGAL_VERSION,
  });
}

export const p4StateLedgerController = {
  ingest: ingestP4StateLedgerTelemetry,
  appendBeat: appendP4InstructionalBeat,
  normalizeTheCall: normalizeTheCallToKeystrokes,
  chunkStream: chunkKeystrokeStream,
} as const;
