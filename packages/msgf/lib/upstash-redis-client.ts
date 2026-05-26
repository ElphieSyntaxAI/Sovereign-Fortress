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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * Upstash Redis REST — serverless-friendly SHARD backend (Cloud Run / Vercel).
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from the Upstash console (Redis tab).
 *
 * This is not Upstash Box (agent API). Box uses UPSTASH_BOX_API_KEY separately.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function trimEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v === "" ? undefined : v;
}

export function isUpstashRedisConfigured(): boolean {
  return Boolean(trimEnv("UPSTASH_REDIS_REST_URL") && trimEnv("UPSTASH_REDIS_REST_TOKEN"));
}

export function upstashRedisFingerprint(): string | null {
  if (!isUpstashRedisConfigured()) return null;
  const url = trimEnv("UPSTASH_REDIS_REST_URL")!;
  const token = trimEnv("UPSTASH_REDIS_REST_TOKEN")!;
  return `upstash:${url}:${token.slice(0, 8)}`;
}

function getClient(): Redis | null {
  if (!isUpstashRedisConfigured()) return null;
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}

function serializeValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export async function upstashRedisPing(): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (err) {
    console.warn(
      "[msgf/upstash-redis] ping failed:",
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

export async function upstashRedisPingWithTimeout(timeoutMs: number): Promise<boolean> {
  const bounded = Math.max(500, Math.min(timeoutMs, 30_000));
  try {
    return await Promise.race([
      upstashRedisPing(),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), bounded);
      }),
    ]);
  } catch {
    return false;
  }
}

export async function upstashRedisGet(key: string): Promise<string | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    const value = await redis.get<string>(key);
    if (value == null) return null;
    return serializeValue(value);
  } catch (err) {
    console.warn("[msgf/upstash-redis] GET failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function upstashRedisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  try {
    if (ttlSeconds != null && ttlSeconds > 0) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn("[msgf/upstash-redis] SET failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function upstashRedisDel(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    /* fail-open */
  }
}

/** SCAN all keys matching `pattern` (Upstash REST). */
export async function upstashRedisScanKeys(
  pattern: string,
  count = 100
): Promise<string[]> {
  const redis = getClient();
  if (!redis) return [];

  const keys: string[] = [];
  let cursor = 0;

  try {
    do {
      const result = await redis.scan(cursor, { match: pattern, count });
      if (Array.isArray(result) && result.length >= 2) {
        cursor = Number(result[0]) || 0;
        const batch = result[1];
        if (Array.isArray(batch)) {
          for (const key of batch) {
            if (typeof key === "string" && key.length > 0) keys.push(key);
          }
        }
      } else {
        break;
      }
    } while (cursor !== 0);
  } catch (err) {
    console.warn(
      "[msgf/upstash-redis] SCAN failed:",
      err instanceof Error ? err.message : String(err)
    );
  }

  return keys;
}

export async function upstashRedisSetNx(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;
  try {
    const opts =
      ttlSeconds != null && ttlSeconds > 0
        ? { nx: true as const, ex: ttlSeconds }
        : { nx: true as const };
    const result = await redis.set(key, value, opts);
    return result === "OK";
  } catch (err) {
    console.warn("[msgf/upstash-redis] SET NX failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function upstashRedisIncrWithWindow(
  key: string,
  windowSeconds: number
): Promise<number | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1 && windowSeconds > 0) {
      await redis.expire(key, windowSeconds);
    }
    return count;
  } catch (err) {
    console.warn("[msgf/upstash-redis] INCR failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Test-only: clear singleton. */
export function __resetUpstashRedisForTests(): void {
  client = null;
}
