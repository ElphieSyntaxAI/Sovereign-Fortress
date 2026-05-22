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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
/**
 * HAL word-window packaging — lightweight MSGF Pulse batches.
 * Default: 175 words per packet, 10-word overlap (no RAG / cadence / grammar).
 */

export const HAL_PACKET_WORDS = 175;
export const HAL_PACKET_OVERLAP_WORDS = 10;

export type HalWordChunk = {
  chunkIndex: number;
  wordStart: number;
  wordEnd: number;
  wordCount: number;
  /** Text for this window only (overlap included for continuity). */
  text: string;
};

export function tokenizeWords(text: string): string[] {
  return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Sliding word windows for incremental HAL → MSGF sync.
 * Step size = packetWords - overlapWords (e.g. 165).
 */
export function buildHalWordChunks(
  fullText: string,
  opts?: { packetWords?: number; overlapWords?: number }
): HalWordChunk[] {
  const packetWords = opts?.packetWords ?? HAL_PACKET_WORDS;
  const overlapWords = opts?.overlapWords ?? HAL_PACKET_OVERLAP_WORDS;
  const words = tokenizeWords(fullText);
  if (words.length === 0) return [];

  const step = Math.max(1, packetWords - overlapWords);
  const chunks: HalWordChunk[] = [];
  let chunkIndex = 0;

  for (let start = 0; start < words.length; start += step) {
    const end = Math.min(words.length, start + packetWords);
    chunks.push({
      chunkIndex,
      wordStart: start,
      wordEnd: end,
      wordCount: end - start,
      text: words.slice(start, end).join(" "),
    });
    chunkIndex += 1;
    if (end >= words.length) break;
  }

  return chunks;
}

/** Chunks with index strictly greater than lastSynced (for incremental flush). */
export function filterChunksAfterIndex(
  chunks: HalWordChunk[],
  lastSyncedChunkIndex: number | null | undefined
): HalWordChunk[] {
  if (lastSyncedChunkIndex == null || !Number.isFinite(lastSyncedChunkIndex)) {
    return chunks;
  }
  const last = Math.floor(lastSyncedChunkIndex);
  return chunks.filter((c) => c.chunkIndex > last);
}

/**
 * Map keystroke DNA events to a word chunk by proportional index (no character offsets required).
 */
export function filterEventsForWordChunk<T>(
  events: readonly T[],
  totalWords: number,
  chunk: HalWordChunk
): T[] {
  if (events.length === 0) return [];
  if (totalWords <= 0) return [...events];

  const startRatio = chunk.wordStart / totalWords;
  const endRatio = chunk.wordEnd / totalWords;
  const startIdx = Math.min(
    events.length - 1,
    Math.max(0, Math.floor(startRatio * events.length))
  );
  const endIdx = Math.max(startIdx + 1, Math.ceil(endRatio * events.length));
  return events.slice(startIdx, endIdx);
}
