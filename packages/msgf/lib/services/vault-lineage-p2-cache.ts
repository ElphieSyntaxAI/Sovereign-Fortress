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
 * P2 Vault lineage — Redis cache (`msgf:lineage:{tenantId}:{documentId}:dual-lawbook`, 300s TTL).
 */

import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRedisClient } from "@/lib/redis-client";
import { redisDel, redisGet, redisSet } from "@/lib/redis";
import {
  DEFAULT_P2_ROADMAP,
  loadP2Roadmap,
  prioritizeVaultLineageForP2,
  type P2RoadmapConfig,
  type PrioritizedVaultLineage,
  type VaultLineageRow,
} from "@/lib/services/p2-flow-roadmap";
import { loadMergedPulseVaultLineage111 } from "@/lib/services/context-loader";

/** Five-minute TTL for lineage + P2 prioritization cache. */
export const VAULT_LINEAGE_CACHE_TTL_SEC = 300;

export function msgfLineageCacheKey(tenantId: string, documentId: string): string {
  const tenant = tenantId.trim() || "unknown";
  const doc = documentId.trim() || "default";
  return `msgf:lineage:${tenant}:${doc}:dual-lawbook`;
}

/**
 * Stable document scope for lineage cache when no manuscript id is supplied.
 */
export function deriveLineageDocumentId(pulseText: string, explicitDocumentId?: string): string {
  const explicit = explicitDocumentId?.trim();
  if (explicit) return explicit.slice(0, 128);
  const seed = pulseText.trim().slice(0, 512);
  if (!seed) return "default";
  return createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 16);
}

type CachedLineagePayload = {
  vault_raw: VaultLineageRow[];
  prioritized: PrioritizedVaultLineage;
  p2_version: string;
  cached_at: string;
};

export type ResolvePrioritizedVaultLineageResult = {
  prioritized: PrioritizedVaultLineage;
  p2Roadmap: P2RoadmapConfig;
  vaultRaw: VaultLineageRow[];
  cacheHit: boolean;
  cacheKey: string;
  documentId: string;
};

export type ResolvePrioritizedVaultLineageParams = {
  supabase: SupabaseClient;
  tenantId: string;
  pulseText: string;
  /** Manuscript / document id — defaults to hash of pulse seed text. */
  documentId?: string;
  p2Roadmap?: P2RoadmapConfig;
  rulesSupabase?: SupabaseClient;
  prioritizeOptions?: Parameters<typeof prioritizeVaultLineageForP2>[2];
};

/**
 * Redis-first Vault 1.1.1 lineage + {@link prioritizeVaultLineageForP2}.
 * On miss: Postgres fetch → prioritize → cache (300s).
 */
export async function resolvePrioritizedVaultLineageForP2(
  params: ResolvePrioritizedVaultLineageParams
): Promise<ResolvePrioritizedVaultLineageResult> {
  const documentId = deriveLineageDocumentId(params.pulseText, params.documentId);
  const cacheKey = msgfLineageCacheKey(params.tenantId, documentId);
  const rulesClient = params.rulesSupabase ?? params.supabase;
  const p2Roadmap =
    params.p2Roadmap ?? (await loadP2Roadmap(rulesClient, params.tenantId));

  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as CachedLineagePayload;
      if (
        parsed.prioritized &&
        parsed.p2_version === p2Roadmap.version &&
        Array.isArray(parsed.vault_raw)
      ) {
        return {
          prioritized: parsed.prioritized,
          p2Roadmap,
          vaultRaw: parsed.vault_raw,
          cacheHit: true,
          cacheKey,
          documentId,
        };
      }
    } catch {
      /* corrupt cache — fall through to DB */
    }
  }

  const vaultRaw = await loadMergedPulseVaultLineage111(
    params.supabase,
    params.pulseText,
    params.tenantId
  );
  const prioritized = prioritizeVaultLineageForP2(
    vaultRaw,
    p2Roadmap,
    params.prioritizeOptions
  );

  const payload: CachedLineagePayload = {
    vault_raw: vaultRaw,
    prioritized,
    p2_version: p2Roadmap.version,
    cached_at: new Date().toISOString(),
  };

  await redisSet(cacheKey, JSON.stringify(payload), VAULT_LINEAGE_CACHE_TTL_SEC);

  return {
    prioritized,
    p2Roadmap,
    vaultRaw,
    cacheHit: false,
    cacheKey,
    documentId,
  };
}

/**
 * Drop cached lineage so the next pulse reloads Vault + global_mitigations from Postgres.
 */
export async function invalidateTenantLineageCache(
  tenantId: string,
  options?: { documentId?: string }
): Promise<number> {
  const tenant = tenantId.trim();
  if (!tenant) return 0;

  let deleted = 0;

  if (options?.documentId?.trim()) {
    await redisDel(msgfLineageCacheKey(tenant, options.documentId.trim()));
    deleted += 1;
  }

  const redis = getRedisClient();
  if (!redis) return deleted;

  const pattern = `msgf:lineage:${tenant}:*`;
  try {
    const stream = redis.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if (!Array.isArray(keys) || keys.length === 0) continue;
      await redis.del(...keys);
      deleted += keys.length;
    }
  } catch (err) {
    console.warn(
      "[vault-lineage-p2-cache] invalidate scan failed:",
      err instanceof Error ? err.message : err
    );
  }

  return deleted;
}

/** @deprecated Use {@link invalidateTenantLineageCache}. */
export async function invalidateAuthorLineageCache(
  tenantId: string,
  options?: { documentId?: string }
): Promise<number> {
  return invalidateTenantLineageCache(tenantId, options);
}
