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
};

function detectPasteWithoutKeys(events: KeystrokeEvent[]): boolean {
  return events.some(
    (e) =>
      e.isSystemEvent === true &&
      (e.key === "PASTE_EVENT" || e.key.toUpperCase().includes("PASTE")) &&
      (e.wordsPasted ?? 0) > 0
  );
}

function resolveLedgerDomain(tenantId: string): P4LedgerDomain {
  return isEducationTenantId(tenantId) ? "education" : "author";
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
  const events = normalizeTheCallToKeystrokes(parsed);

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

  const { chunks, results: verifyResults } = await p4.verifyKeystrokeStream(
    input.entityId,
    events
  );

  await setActiveSlice({
    entityId: input.entityId,
    previousBeats,
    previousRetryCount,
  });

  const suggestedBreakdowns: GenealogicalBugIndex[] = [];
  if (detectPasteWithoutKeys(events)) {
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
  };
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
