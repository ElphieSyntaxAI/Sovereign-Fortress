/**
 * Per-tenant ring of recent prompt embeddings for Active similar-prompt hits.
 * Shadow eval may read it in the background. It is not copied off the tenant.
 */

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import {
  bestSimilarityMatch,
  MSGF_MEMORY_SIMILARITY_THRESHOLD,
} from "@/lib/gateway/memory-similarity";

const RING_MAX = 32;
const TTL_SEC = Number(process.env.MSGF_GATEWAY_COMPLETION_CACHE_TTL_SEC?.trim()) || 3600;

export type SemanticRingEntry = {
  promptHash: string;
  embedding: number[];
  text: string;
  model: string;
};

function ringKey(tenantId: string): string {
  return msgfRedisKey("gateway-semantic-ring", tenantId.trim());
}

export function semanticCacheEnabled(): boolean {
  const v = process.env.MSGF_GATEWAY_SEMANTIC_CACHE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

async function readRing(tenantId: string): Promise<SemanticRingEntry[]> {
  const raw = await redisGet(ringKey(tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SemanticRingEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function rememberTenantPromptEmbedding(input: {
  tenantId: string;
  promptHash: string;
  embedding: number[];
  text: string;
  model: string;
}): Promise<void> {
  if (!semanticCacheEnabled()) return;
  if (!input.embedding.length || !input.text.trim()) return;
  const ring = await readRing(input.tenantId);
  const next = [
    {
      promptHash: input.promptHash,
      embedding: input.embedding,
      text: input.text,
      model: input.model,
    },
    ...ring.filter((row) => row.promptHash !== input.promptHash),
  ].slice(0, RING_MAX);
  await redisSet(ringKey(input.tenantId), JSON.stringify(next), TTL_SEC);
}

export async function findSimilarTenantCompletion(input: {
  tenantId: string;
  embedding: number[];
  exceptHash?: string;
  threshold?: number;
}): Promise<{ entry: SemanticRingEntry; score: number } | null> {
  if (!semanticCacheEnabled()) return null;
  const ring = (await readRing(input.tenantId)).filter(
    (row) => row.promptHash !== input.exceptHash
  );
  const best = bestSimilarityMatch(
    input.embedding,
    ring.map((entry) => ({ embedding: entry.embedding, item: entry })),
    input.threshold ?? MSGF_MEMORY_SIMILARITY_THRESHOLD
  );
  if (!best) return null;
  return { entry: best.item, score: best.score };
}
