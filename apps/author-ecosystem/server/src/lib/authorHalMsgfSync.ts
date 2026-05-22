import {
  authorHalSnapshotFromScores,
  buildChunkedAuthorPulseBodiesFromContent,
  type AuthorHalDnaEvent,
  type AuthorHalTelemetrySnapshot,
} from "msgf/hal-author-bridge";

import {
  forwardAuthorPulseToMsgf,
  type AuthorMsgfPulseResult,
} from "./msgfPulseBridge.js";

export type AuthorHalMsgfSyncResult = {
  packetsSent: number;
  lastChunkIndex: number | null;
  results: AuthorMsgfPulseResult[];
  errors: string[];
};

/**
 * Push Author HAL rhythm to MSGF in 175-word windows (10-word overlap).
 * Telemetry only — no RAG, cadence, or grammar payloads.
 */
export async function syncAuthorHalChunksToMsgf(params: {
  userId: string;
  tenantId: string;
  manuscriptId: string;
  contentDelta: string;
  events: readonly AuthorHalDnaEvent[];
  halScore: number;
  typingScore: number;
  locale: string;
  isImeSession: boolean;
  rhythmUnitCount: number;
  wordCount: number;
  isTrainingPhase?: boolean;
  sessionId?: string;
  lastSyncedChunkIndex?: number | null;
}): Promise<AuthorHalMsgfSyncResult> {
  const targetPrefix = `author:${params.manuscriptId}`;
  const packets = buildChunkedAuthorPulseBodiesFromContent({
    contentDelta: params.contentDelta,
    events: params.events,
    targetPrefix,
    lastSyncedChunkIndex: params.lastSyncedChunkIndex,
  });

  const results: AuthorMsgfPulseResult[] = [];
  const errors: string[] = [];
  let lastChunkIndex: number | null =
    params.lastSyncedChunkIndex != null ? Math.floor(params.lastSyncedChunkIndex) : null;

  for (const packet of packets) {
    const authorHal: AuthorHalTelemetrySnapshot = authorHalSnapshotFromScores({
      halScore: params.halScore,
      typingScore: params.typingScore,
      locale: params.locale,
      isImeSession: params.isImeSession,
      rhythmUnitCount: params.rhythmUnitCount,
      wordCount: params.wordCount,
      isTrainingPhase: params.isTrainingPhase,
      chunkIndex: packet.chunkIndex,
    });

    const r = await forwardAuthorPulseToMsgf({
      userId: params.userId,
      tenantId: params.tenantId,
      body: packet.body,
      authorHal,
      idempotencyKey: params.sessionId
        ? `hal:${params.sessionId}:c${packet.chunkIndex}`
        : `hal:${params.manuscriptId}:c${packet.chunkIndex}`,
    });

    results.push(r);
    lastChunkIndex = packet.chunkIndex;
    if (!r.ok && r.error) errors.push(r.error);
  }

  return {
    packetsSent: packets.length,
    lastChunkIndex,
    results,
    errors,
  };
}
