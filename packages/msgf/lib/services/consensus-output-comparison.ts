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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * Normalized string / shallow structural similarity for dual-model consensus scoring (0–1).
 */

/** Strip JSON/code fences and collapse whitespace for lexical comparison. */
export function normalizeConsensusComparableText(text: string): string {
  const s = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim()
    .toLowerCase();
  return s.replace(/\s+/g, " ");
}

export function tokenizeConsensusComparable(text: string): string[] {
  const n = normalizeConsensusComparableText(text);
  if (!n) return [];
  return n.split(/[^a-z0-9_]+/).filter((t) => t.length > 0);
}

/** Sørensen–Dice coefficient on token multisets (bigrams fallback when token sparse). */
export function computeConsensusAgreementScore(modelOutA: string, modelOutB: string): number {
  const tokA = tokenizeConsensusComparable(modelOutA);
  const tokB = tokenizeConsensusComparable(modelOutB);

  const diceFromTokens = (a: string[], b: string[]): number => {
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    const freqB = new Map<string, number>();
    for (const t of b) freqB.set(t, (freqB.get(t) ?? 0) + 1);
    let intersection = 0;
    for (const t of a) {
      const c = freqB.get(t);
      if (c && c > 0) {
        intersection += 1;
        freqB.set(t, c - 1);
      }
    }
    return (2 * intersection) / (a.length + b.length);
  };

  let score = diceFromTokens(tokA, tokB);
  if (score < 0.15 && modelOutA.length > 12 && modelOutB.length > 12) {
    const bi = (tokens: string[]) => {
      const out: string[] = [];
      for (let i = 0; i < tokens.length - 1; i++) {
        out.push(`${tokens[i]}_${tokens[i + 1]}`);
      }
      return out;
    };
    const ba = bi(tokA);
    const bb = bi(tokB);
    if (ba.length && bb.length) {
      score = Math.max(score, diceFromTokens(ba, bb));
    }
  }

  return Math.max(0, Math.min(1, score));
}
