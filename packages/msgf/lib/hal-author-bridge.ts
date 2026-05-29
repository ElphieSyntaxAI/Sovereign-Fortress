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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * Author HAL → MSGF universal Pulse bridge (lossless rhythm, word-chunked packets).
 * Excludes Author RAG, cadence, grammar, and manuscript narrative pipelines.
 */

import {
  buildHalWordChunks,
  filterChunksAfterIndex,
  filterEventsForWordChunk,
  HAL_PACKET_OVERLAP_WORDS,
  HAL_PACKET_WORDS,
  type HalWordChunk,
} from "./hal-word-chunk-packet.js";
import {
  toUniversalP1PulseBody,
  type UniversalP1KeystrokeEvent,
  type UniversalP1PulseBody,
} from "../src/lib/universal/p1HalStandard.js";
import type { AuthorHalTelemetrySnapshot } from "./hal-author-telemetry.js";

export {
  serializeAuthorHalTelemetry,
  parseAuthorHalTelemetryHeader,
  mergeTrustedAuthorHalBiometric,
} from "./hal-author-telemetry.js";
export const MSGF_AUTHOR_HAL_HEADER = "x-msgf-author-hal";

export {
  HAL_PACKET_WORDS,
  HAL_PACKET_OVERLAP_WORDS,
  buildHalWordChunks,
  filterChunksAfterIndex,
  type HalWordChunk,
};
export type { AuthorHalTelemetrySnapshot };

/** Author extension / HALTracker / BFF forensic event (no content semantics). */
export type AuthorHalDnaEvent = {
  key: string;
  timestamp?: string | number;
  flightTime?: number;
  dwellTime?: number;
  flightMs?: number;
  dwellMs?: number;
  isBackspace?: boolean;
  isSystemEvent?: boolean;
  wordsPasted?: number;
};

function toEpochMs(timestamp: string | number | undefined, fallback: number): number {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp < 1e12 ? timestamp : timestamp;
  }
  if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Lossless map: dwell/flight/paste flags preserved for MSGF Pulse + biometric scoring.
 */
export function authorHalEventsToUniversalKeystrokes(
  events: readonly AuthorHalDnaEvent[],
  opts?: { startTs?: number; target?: string }
): UniversalP1KeystrokeEvent[] {
  const startTs = opts?.startTs ?? Date.now();
  let cursor = startTs;
  const out: UniversalP1KeystrokeEvent[] = [];

  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    if (e.isSystemEvent === true || e.key === "PASTE_EVENT") {
      const ts = toEpochMs(e.timestamp, cursor);
      cursor = ts;
      out.push({
        ts,
        key: e.key === "PASTE_EVENT" ? "PASTE_EVENT" : "<PASTE>",
        type: "input",
        isSystemEvent: true,
        wordsPasted:
          typeof e.wordsPasted === "number" && e.wordsPasted >= 0
            ? Math.floor(e.wordsPasted)
            : undefined,
        ...(opts?.target ? { target: opts.target } : {}),
      });
      continue;
    }

    const flight =
      typeof e.flightMs === "number"
        ? e.flightMs
        : typeof e.flightTime === "number"
          ? e.flightTime
          : undefined;
    const dwell =
      typeof e.dwellMs === "number"
        ? e.dwellMs
        : typeof e.dwellTime === "number"
          ? e.dwellTime
          : undefined;

    if (typeof flight === "number" && Number.isFinite(flight) && flight >= 0) {
      cursor += Math.max(1, Math.round(flight));
    }
    const ts = toEpochMs(e.timestamp, cursor);

    const key =
      typeof e.key === "string" && e.key.trim() ? e.key.trim().slice(0, 64) : "AuthorHAL";

    out.push({
      ts,
      key,
      type: "keydown",
      ...(typeof dwell === "number" && dwell >= 0 ? { dwellMs: Math.round(dwell) } : {}),
      ...(typeof flight === "number" && flight >= 0 ? { flightMs: Math.round(flight) } : {}),
      ...(e.isBackspace === true ? { isBackspace: true } : {}),
      ...(opts?.target ? { target: opts.target } : {}),
    });
  }

  if (out.length === 0 && events.length > 0) {
    return latenciesOnlyFallback(events, opts);
  }

  return out.sort((a, b) => a.ts - b.ts);
}

/** Back-compat when only latency numbers exist on legacy rows. */
export function latenciesOnlyFallback(
  events: readonly AuthorHalDnaEvent[],
  opts?: { startTs?: number; target?: string }
): UniversalP1KeystrokeEvent[] {
  const latencies: number[] = [];
  for (const e of events) {
    if (e?.isSystemEvent === true || e?.key === "PASTE_EVENT") continue;
    const ft = Number(e.flightTime ?? e.flightMs);
    if (Number.isFinite(ft) && ft >= 0) latencies.push(Math.round(ft));
  }
  let cursor = opts?.startTs ?? Date.now();
  return latencies.map((n) => {
    cursor += Math.max(1, n);
    return {
      ts: cursor,
      key: "AuthorHAL",
      type: "input" as const,
      flightMs: n,
      ...(opts?.target ? { target: opts.target } : {}),
    };
  });
}

export type ChunkedAuthorPulsePacket = {
  chunkIndex: number;
  wordCount: number;
  body: UniversalP1PulseBody;
};

/**
 * Build chunked packets from full content (word-split) + keystroke DNA.
 */
export function buildChunkedAuthorPulseBodiesFromContent(input: {
  contentDelta: string;
  events: readonly AuthorHalDnaEvent[];
  targetPrefix: string;
  lastSyncedChunkIndex?: number | null;
  packetWords?: number;
  overlapWords?: number;
}): ChunkedAuthorPulsePacket[] {
  const words = input.contentDelta.trim().split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  if (totalWords === 0) {
    const keystrokes = authorHalEventsToUniversalKeystrokes(input.events, {
      target: input.targetPrefix,
    });
    if (keystrokes.length === 0) return [];
    return [
      {
        chunkIndex: 0,
        wordCount: 0,
        body: toUniversalP1PulseBody({ keystrokes }),
      },
    ];
  }

  const chunks = buildHalWordChunks(input.contentDelta, {
    packetWords: input.packetWords ?? HAL_PACKET_WORDS,
    overlapWords: input.overlapWords ?? HAL_PACKET_OVERLAP_WORDS,
  });
  const toSend = filterChunksAfterIndex(chunks, input.lastSyncedChunkIndex);
  const packets: ChunkedAuthorPulsePacket[] = [];

  for (const chunk of toSend) {
    const slice = filterEventsForWordChunk(input.events, totalWords, chunk);
    const keystrokes = authorHalEventsToUniversalKeystrokes(slice, {
      target: `${input.targetPrefix}:chunk=${chunk.chunkIndex}`,
    });
    if (keystrokes.length === 0) continue;
    packets.push({
      chunkIndex: chunk.chunkIndex,
      wordCount: chunk.wordCount,
      body: toUniversalP1PulseBody({ keystrokes }),
    });
  }

  return packets;
}

export function authorHalSnapshotFromScores(input: {
  halScore: number;
  typingScore: number;
  locale: string;
  isImeSession: boolean;
  rhythmUnitCount: number;
  wordCount: number;
  isTrainingPhase?: boolean;
  chunkIndex?: number;
}): AuthorHalTelemetrySnapshot {
  const scale = input.halScore <= 1 ? 100 : 1;
  return {
    halScore: Math.round(Math.max(0, Math.min(100, input.halScore * scale)) * 100) / 100,
    typingScore: Math.round(Math.max(0, Math.min(100, input.typingScore * scale)) * 100) / 100,
    isImeSession: input.isImeSession,
    locale: input.locale,
    rhythmUnitCount: input.rhythmUnitCount,
    wordCount: input.wordCount,
    isTrainingPhase: input.isTrainingPhase,
    chunkIndex: input.chunkIndex,
    packetWords: HAL_PACKET_WORDS,
  };
}
