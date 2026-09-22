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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Trusted Author BFF HAL snapshot — rhythm/stylometric scores only (no RAG payload).
 */

export type AuthorHalTelemetrySnapshot = {
  /** 0–100 composite from Author `computeHalScore` × linguistic factor */
  halScore: number;
  typingScore: number;
  isImeSession: boolean;
  locale: string;
  rhythmUnitCount: number;
  wordCount: number;
  isTrainingPhase?: boolean;
  chunkIndex?: number;
  packetWords?: number;
};

export function serializeAuthorHalTelemetry(
  snapshot: AuthorHalTelemetrySnapshot
): string {
  return JSON.stringify(snapshot);
}

export function parseAuthorHalTelemetryHeader(
  raw: string | null | undefined
): AuthorHalTelemetrySnapshot | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const halScore = Number(o.halScore);
    const typingScore = Number(o.typingScore);
    if (!Number.isFinite(halScore) || !Number.isFinite(typingScore)) return null;
    return {
      halScore: Math.max(0, Math.min(100, halScore)),
      typingScore: Math.max(0, Math.min(100, typingScore)),
      isImeSession: o.isImeSession === true,
      locale: typeof o.locale === "string" ? o.locale : "en",
      rhythmUnitCount: Number(o.rhythmUnitCount) || 0,
      wordCount: Number(o.wordCount) || 0,
      isTrainingPhase: o.isTrainingPhase === true,
      chunkIndex:
        typeof o.chunkIndex === "number" && Number.isFinite(o.chunkIndex)
          ? o.chunkIndex
          : undefined,
      packetWords:
        typeof o.packetWords === "number" && Number.isFinite(o.packetWords)
          ? o.packetWords
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Blend MSGF rhythm biometric with trusted Author HAL (BFF / IDE pulse only).
 */
export function mergeTrustedAuthorHalBiometric(
  msgfBiometricScore: number,
  author: AuthorHalTelemetrySnapshot | null | undefined
): number {
  if (!author) return msgfBiometricScore;
  const authorScore = Math.max(0, Math.min(100, author.halScore));
  const blended = msgfBiometricScore * 0.55 + authorScore * 0.45;
  if (author.isTrainingPhase) {
    return Math.max(msgfBiometricScore, blended) * 0.92 + 8;
  }
  return Math.round(Math.max(0, Math.min(100, blended)) * 100) / 100;
}
