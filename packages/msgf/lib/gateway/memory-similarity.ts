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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Tenant memory match: exact content hash, then cosine similarity.
 * Embeddings stay in the tenant. Global Brain and Big Brain do not receive them.
 */

import { createHash } from "node:crypto";

/** Near-duplicate threshold for Vault retrieval and the Active completion cache. */
export const MSGF_MEMORY_SIMILARITY_THRESHOLD = 0.92;

export function normalizeMemoryText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function memoryContentHash(text: string): string {
  return createHash("sha256").update(normalizeMemoryText(text), "utf8").digest("hex");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 1 on exact hash. Cosine when both embeddings exist and the score is at or above the threshold.
 * Null when the row must stay out of context.
 */
export function scoreMemoryMatch(input: {
  queryText: string;
  rowText: string;
  queryEmbedding?: number[] | null;
  rowEmbedding?: number[] | null;
  threshold?: number;
}): number | null {
  if (memoryContentHash(input.queryText) === memoryContentHash(input.rowText)) {
    return 1;
  }
  const threshold = input.threshold ?? MSGF_MEMORY_SIMILARITY_THRESHOLD;
  const q = input.queryEmbedding;
  const r = input.rowEmbedding;
  if (!q?.length || !r?.length) return null;
  const score = cosineSimilarity(q, r);
  return score >= threshold ? score : null;
}

export function bestSimilarityMatch<T>(
  queryEmbedding: number[],
  candidates: Array<{ embedding: number[]; item: T; promptHash?: string }>,
  threshold = MSGF_MEMORY_SIMILARITY_THRESHOLD
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = cosineSimilarity(queryEmbedding, candidate.embedding);
    if (score < threshold) continue;
    if (!best || score > best.score) best = { item: candidate.item, score };
  }
  return best;
}
