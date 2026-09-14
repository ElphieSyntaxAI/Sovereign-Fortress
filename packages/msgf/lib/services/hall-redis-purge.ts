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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * V3.2 PERSIST — Redis / Upstash hot-layer hygiene for stale Hall-adjacent caches.
 *
 * Complements cold-layer {@link runHallPurgeProtocol} (Postgres). Targets keys that can
 * retain self-heal / local-delta copies without strict TTL enforcement.
 */

import { isRedisConfigured, msgfRedisKey, redisDel, redisGet } from "@/lib/redis";
import { getRedisClient } from "@/lib/redis-client";
import {
  isUpstashRedisConfigured,
  upstashRedisScanKeys,
} from "@/lib/upstash-redis-client";

export const HALL_REDIS_PURGE_DEFAULT_RETENTION_DAYS = 30;

/** SCAN patterns for Hall / local-delta hot caches (not short-TTL Pulse session keys). */
export const HALL_REDIS_SCAN_PATTERNS = [
  msgfRedisKey("local_state_cache", "*"),
  "msgf:lineage:*",
] as const;

export type HallRedisPurgeResult = {
  ok: true;
  protocol: "v3.2_hall_redis_purge";
  backend: "upstash" | "ioredis" | "skipped";
  executed_at: string;
  retention_days: number;
  dry_run: boolean;
  scanned: number;
  deleted: number;
  retained: number;
  would_delete: number;
  patterns: string[];
  skip_reason?: string;
};

export type RunHallRedisPurgeOptions = {
  days?: number;
  dryRun?: boolean;
  patterns?: readonly string[];
};

function retentionCutoffMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isHallLedgerMetadata(meta: unknown): boolean {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return false;
  const ledger = (meta as { ledger?: unknown }).ledger;
  return typeof ledger === "string" && ledger.toLowerCase() === "hall";
}

/**
 * Decide whether a hot-layer key should be removed during Hall maintenance.
 */
export function shouldPurgeHallRedisEntry(
  key: string,
  raw: string,
  cutoffMs: number
): boolean {
  if (!raw.trim()) return true;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return true;
  }

  if (key.includes(":local_state_cache:")) {
    const savedAt =
      parseIsoMs(parsed.saved_at) ??
      parseIsoMs(parsed.created_at) ??
      parseIsoMs(parsed.expires_at);
    if (savedAt != null && savedAt < cutoffMs) return true;

    const meta = parsed.metadata;
    if (isHallLedgerMetadata(meta)) return true;

    const bugIndex = parsed.bug_index;
    if (bugIndex != null && typeof bugIndex === "object" && !Array.isArray(bugIndex)) {
      const tier = (bugIndex as { tier?: unknown }).tier;
      if (typeof tier === "string" && tier.toUpperCase() === "LOW") return true;
    }
    return false;
  }

  if (key.includes(":lineage:")) {
    const cachedAt = parseIsoMs(parsed.cached_at);
    if (cachedAt != null && cachedAt < cutoffMs) return true;
    return false;
  }

  return false;
}

async function scanKeysIoredis(pattern: string): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  const keys: string[] = [];
  try {
    const stream = redis.scanStream({ match: pattern, count: 100 });
    for await (const batch of stream) {
      if (!Array.isArray(batch)) continue;
      for (const key of batch) {
        if (typeof key === "string" && key.length > 0) keys.push(key);
      }
    }
  } catch (err) {
    console.warn(
      "[hall-redis-purge] ioredis SCAN failed:",
      err instanceof Error ? err.message : err
    );
  }
  return keys;
}

async function scanKeysForPattern(pattern: string): Promise<string[]> {
  if (isUpstashRedisConfigured()) {
    return upstashRedisScanKeys(pattern, 100);
  }
  return scanKeysIoredis(pattern);
}

/**
 * Purge stale Hall-related entries from Redis / Upstash (hot layer).
 */
export async function runHallRedisPurge(
  options: RunHallRedisPurgeOptions = {}
): Promise<HallRedisPurgeResult> {
  const days = options.days ?? HALL_REDIS_PURGE_DEFAULT_RETENTION_DAYS;
  const dryRun = options.dryRun ?? false;
  const patterns = options.patterns ?? HALL_REDIS_SCAN_PATTERNS;
  const executedAt = new Date().toISOString();
  const cutoffMs = retentionCutoffMs(days);

  if (!isRedisConfigured()) {
    return {
      ok: true,
      protocol: "v3.2_hall_redis_purge",
      backend: "skipped",
      executed_at: executedAt,
      retention_days: days,
      dry_run: dryRun,
      scanned: 0,
      deleted: 0,
      retained: 0,
      would_delete: 0,
      patterns: [...patterns],
      skip_reason: "redis_not_configured",
    };
  }

  const backend: HallRedisPurgeResult["backend"] = isUpstashRedisConfigured()
    ? "upstash"
    : "ioredis";

  const seen = new Set<string>();
  let scanned = 0;
  let deleted = 0;
  let retained = 0;
  let wouldDelete = 0;

  for (const pattern of patterns) {
    const keys = await scanKeysForPattern(pattern);
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      scanned += 1;

      const raw = (await redisGet(key)) ?? "";
      if (!shouldPurgeHallRedisEntry(key, raw, cutoffMs)) {
        retained += 1;
        continue;
      }

      wouldDelete += 1;
      if (!dryRun) {
        await redisDel(key);
        deleted += 1;
      }
    }
  }

  return {
    ok: true,
    protocol: "v3.2_hall_redis_purge",
    backend,
    executed_at: executedAt,
    retention_days: days,
    dry_run: dryRun,
    scanned,
    deleted: dryRun ? 0 : deleted,
    retained,
    would_delete: wouldDelete,
    patterns: [...patterns],
  };
}
