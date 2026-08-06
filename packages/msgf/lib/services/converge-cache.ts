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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Redis hot-layer cache for global dual-model CONVERGE (Gemini + Claude).
 * Key: SHA256(tenantId + contentHash + routingProfile) — P4 TTL 600s default.
 */

import { createHash } from "node:crypto";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import {
  recordSavingsFeatureCount,
  recordSavingsFeatureTokensSaved,
} from "@/lib/services/savings-features-stats";
import {
  computeConsensusAgreementScore,
  normalizeConsensusComparableText,
} from "@/lib/services/consensus-output-comparison";
import { DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD } from "@/lib/services/dual-model-consensus-gateway";
import { MSGF_NAIVE_DUAL_CONVERGE_TOKENS } from "@/lib/services/token-usage-estimate";
import { getRollingConvergeBaselineTokens } from "@/lib/services/provider-usage-meter";
import {
  recordEstimatedSavingsTokens,
  recordProvenAvoidance,
} from "@/lib/services/proven-savings";

/** P4 hot-layer semantics — fresh CONVERGE replay window for debug / test loops. */
export const CONVERGE_CACHE_TTL_SECONDS =
  Number(process.env.MSGF_CONVERGE_CACHE_TTL_SEC?.trim()) || 600;

export const CONVERGE_CACHE_AGREEMENT_THRESHOLD = DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD;

export type ConvergeCachedChunk = {
  gemini: { verdict: string; reason: string };
  claude: { verdict: string; reason: string };
  grok?: { verdict: string; reason: string };
  agreement: boolean;
  decision: string;
  halScore: number;
  vote_tally?: {
    HUMAN: number;
    NON_HUMAN: number;
    INCONCLUSIVE: number;
    total: number;
    majorityLabel: string | null;
    no_majority: boolean;
  };
  consensus_mode?: string;
  consensus_providers?: string[];
};

export type ConvergeCacheEntry = {
  resolution: string;
  agreement_score: number;
  consensus: ConvergeCachedChunk[];
  cached_at: string;
};

export type GetOrSetConvergeCacheResult = {
  cacheHit: boolean;
  resolution: string;
  agreementScore: number;
  consensus: ConvergeCachedChunk[];
};

export function isConvergeCacheEnabled(): boolean {
  const v = process.env.MSGF_CONVERGE_CACHE_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return true;
}

/**
 * Deterministic SHA-256 digest for Redis key material (not stored as raw PII).
 */
export function buildConvergeCacheDigest(
  tenantId: string,
  contentHash: string,
  routingProfile: string
): string {
  return createHash("sha256")
    .update(
      `${tenantId.trim()}|${contentHash.trim()}|${routingProfile.trim()}`,
      "utf8"
    )
    .digest("hex");
}

export function buildConvergeCacheRedisKey(
  tenantId: string,
  contentHash: string,
  routingProfile: string
): string {
  return msgfRedisKey("converge", "cache", buildConvergeCacheDigest(tenantId, contentHash, routingProfile));
}

/** Stable hash of pulse + shardable context used for CONVERGE prompts. */
export function computeConvergeContentHash(parts: {
  pulseText: string;
  beatsContext?: string;
  vaultCrossRefFingerprint?: string;
}): string {
  const material = [
    parts.pulseText.trim().slice(0, 8192),
    (parts.beatsContext ?? "").trim().slice(0, 2048),
    (parts.vaultCrossRefFingerprint ?? "").trim().slice(0, 1024),
  ].join("\n---\n");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function resolveConvergeRoutingProfile(
  credentialMode:
    | "corporate_system"
    | "individual_perpetual_platform"
    | "individual_byok",
  geminiModelId: string
): string {
  const model = geminiModelId.trim() || "default";
  return `global_converge:${credentialMode}:${model}`;
}

export function buildConvergeResolutionString(chunks: ConvergeCachedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[chunk ${i}] gemini=${c.gemini.verdict}:${normalizeConsensusComparableText(c.gemini.reason).slice(0, 200)} | claude=${c.claude.verdict}:${normalizeConsensusComparableText(c.claude.reason).slice(0, 200)}`
    )
    .join("\n");
}

export function computeConvergeAgreementScore(chunks: ConvergeCachedChunk[]): number {
  const geminiBlob = chunks.map((c) => `${c.gemini.verdict} ${c.gemini.reason}`).join("\n");
  const claudeBlob = chunks.map((c) => `${c.claude.verdict} ${c.claude.reason}`).join("\n");
  return computeConsensusAgreementScore(geminiBlob, claudeBlob);
}

let inMemoryConvergeCacheStore: Map<string, string> | null = null;

/** Test-only: bind an in-memory Redis map for savings QA (no TCP / Upstash). */
export function __bindInMemoryConvergeCacheStoreForTests(
  store: Map<string, string> | null
): void {
  inMemoryConvergeCacheStore = store;
}

async function convergeCacheRedisGet(key: string): Promise<string | null> {
  if (inMemoryConvergeCacheStore) {
    return inMemoryConvergeCacheStore.get(key) ?? null;
  }
  return redisGet(key);
}

async function convergeCacheRedisSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  if (inMemoryConvergeCacheStore) {
    inMemoryConvergeCacheStore.set(key, value);
    void ttlSeconds;
    return;
  }
  await redisSet(key, value, ttlSeconds);
}

async function readConvergeCache(redisKey: string): Promise<ConvergeCacheEntry | null> {
  const raw = await convergeCacheRedisGet(redisKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConvergeCacheEntry;
    if (
      typeof parsed.resolution === "string" &&
      typeof parsed.agreement_score === "number" &&
      Array.isArray(parsed.consensus)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

async function writeConvergeCache(redisKey: string, entry: ConvergeCacheEntry): Promise<void> {
  await convergeCacheRedisSet(redisKey, JSON.stringify(entry), CONVERGE_CACHE_TTL_SECONDS);
}

/**
 * Core token baseline for a full dual-model CONVERGE (reporting only).
 */
export function estimateCoreConvergeTokenBaseline(packetCount = 1): number {
  return MSGF_NAIVE_DUAL_CONVERGE_TOKENS * Math.max(1, packetCount);
}

export function recordConvergeCacheEcoHit(params: {
  tenantId: string;
  entityId?: string;
  projectOrigin?: string;
  tokensSaved?: number;
}): void {
  const tid = params.tenantId.trim();
  if (!tid) return;
  const projectOrigin = params.projectOrigin?.trim();
  if (!projectOrigin) return;

  void (async () => {
    const baseline = await getRollingConvergeBaselineTokens(tid, 2);
    if (baseline && baseline.tokens > 0 && baseline.sample_count >= 2) {
      await recordProvenAvoidance(
        {
          tenant_id: tid,
          reason: "converge_cache_hit",
          tokens_avoided: baseline.tokens,
          baseline_tokens: baseline.tokens,
          local_tokens: 0,
          evidence: "proven_avoidance",
          baseline_source: "rolling_metered_median",
          sample_count: baseline.sample_count,
        },
        { userId: params.entityId?.trim(), projectOrigin }
      );
      return;
    }
    // No metered baseline yet — keep estimate on ops counters only.
    const estimated = params.tokensSaved ?? estimateCoreConvergeTokenBaseline(1);
    void recordEstimatedSavingsTokens(tid, estimated);
  })();
}

/**
 * Check Redis for a prior dual-model CONVERGE resolution; on miss run cloud CONVERGE and cache successes.
 */
export async function getOrSetConvergeCache(params: {
  tenantId: string;
  contentHash: string;
  routingProfile: string;
  entityId?: string;
  projectOrigin?: string;
  packetCount?: number;
  runConverge: () => Promise<{
    resolution: string;
    agreementScore: number;
    consensus: ConvergeCachedChunk[];
  }>;
}): Promise<GetOrSetConvergeCacheResult> {
  if (!isConvergeCacheEnabled()) {
    const fresh = await params.runConverge();
    return {
      cacheHit: false,
      resolution: fresh.resolution,
      agreementScore: fresh.agreementScore,
      consensus: fresh.consensus,
    };
  }

  const redisKey = buildConvergeCacheRedisKey(
    params.tenantId,
    params.contentHash,
    params.routingProfile
  );

  const cached = await readConvergeCache(redisKey);
  if (cached) {
    const tokensSaved = estimateCoreConvergeTokenBaseline(params.packetCount ?? 1);
    void recordSavingsFeatureCount(params.tenantId, "converge_cache_hit");
    void recordSavingsFeatureTokensSaved(
      params.tenantId,
      "converge_cache_hit",
      tokensSaved
    );
    recordConvergeCacheEcoHit({
      tenantId: params.tenantId,
      entityId: params.entityId,
      projectOrigin: params.projectOrigin,
      tokensSaved,
    });
    return {
      cacheHit: true,
      resolution: cached.resolution,
      agreementScore: cached.agreement_score,
      consensus: cached.consensus,
    };
  }

  const fresh = await params.runConverge();
  if (fresh.agreementScore >= CONVERGE_CACHE_AGREEMENT_THRESHOLD) {
    await writeConvergeCache(redisKey, {
      resolution: fresh.resolution,
      agreement_score: fresh.agreementScore,
      consensus: fresh.consensus,
      cached_at: new Date().toISOString(),
    });
  }

  return {
    cacheHit: false,
    resolution: fresh.resolution,
    agreementScore: fresh.agreementScore,
    consensus: fresh.consensus,
  };
}
