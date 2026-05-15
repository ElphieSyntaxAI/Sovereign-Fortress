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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * Modular MSGF Redis client (ioredis) — connection from `process.env.REDIS_URL`.
 * Fail-open when unset; cold layer (Postgres) remains authoritative.
 */

import Redis from "ioredis";

let client: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/**
 * Lazy singleton ioredis client. Returns null when `REDIS_URL` is missing.
 */
export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      console.warn(
        "[msgf/redis-client] error:",
        err instanceof Error ? err.message : String(err)
      );
    });
  }

  return client;
}

/** Await ready state (ioredis `lazyConnect` connects on first command). */
export async function ensureRedisConnected(): Promise<Redis | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  if (redis.status === "ready") return redis;
  try {
    await redis.ping();
    return redis;
  } catch (err) {
    console.warn(
      "[msgf/redis-client] ping failed:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    console.warn("[msgf/redis-client] GET failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    if (ttlSeconds != null && ttlSeconds > 0) {
      await redis.set(key, value, "EX", ttlSeconds);
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (err) {
    console.warn("[msgf/redis-client] SET failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function redisDel(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    /* fail-open */
  }
}

/** Test-only: disconnect and clear singleton. */
export async function __resetRedisClientForTests(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
  client = null;
}
