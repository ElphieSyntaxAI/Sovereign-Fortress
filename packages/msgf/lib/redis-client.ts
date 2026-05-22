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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * Modular MSGF Redis client (ioredis).
 *
 * **Connection**
 * - **Preferred (GCP Memorystore / Docker Compose service names):** `REDIS_HOST`, optional
 *   `REDIS_PORT` (default `6379`), optional `REDIS_PASSWORD`.
 * - **Upstash Redis REST (serverless):** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *   (HTTP — no VPC; ideal for Cloud Run). Checked before TCP clients when set.
 * - **Legacy / local:** `REDIS_URL` (e.g. `redis://127.0.0.1:6379`, `rediss://…` for TLS URL mode).
 *
 * When `REDIS_HOST` is set (and Upstash is not), it wins over `REDIS_URL` for Memorystore.
 *
 * **TLS**
 * - URL scheme `rediss://` enables TLS automatically (ioredis).
 * - Host/port mode: set `REDIS_TLS=1` (or `REDIS_USE_TLS=1`). Optional `REDIS_TLS_REJECT_UNAUTHORIZED=0`
 *   disables certificate verification (avoid in production unless required).
 *
 * Fail-open when unset; cold layer (Postgres) remains authoritative.
 */

import type { ConnectionOptions } from "node:tls";
import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

import {
  isUpstashRedisConfigured,
  upstashRedisDel,
  upstashRedisGet,
  upstashRedisIncrWithWindow,
  upstashRedisPing,
  upstashRedisPingWithTimeout,
  upstashRedisSet,
  upstashRedisSetNx,
  __resetUpstashRedisForTests,
} from "@/lib/upstash-redis-client";

let client: Redis | null = null;
/** Guards stale singleton if env-derived wiring changes without calling reset. */
let clientFingerprint: string | null = null;

const REDIS_DEFAULT_PORT = 6379;
const CONNECT_TIMEOUT_MS = 15_000;
const KEEP_ALIVE_MS = 30_000;

/** Exponential backoff for socket reconnects (VPC blips, scale-up, Memorystore failover). */
const RECONNECT_BASE_DELAY_MS = 250;
const RECONNECT_MAX_DELAY_MS = 60_000;

/** Bounded backoff while awaiting first successful ping (`ensureRedisConnected`). */
const ENSURE_FIRST_CONNECTED_BASE_MS = 300;
const ENSURE_FIRST_CONNECTED_MAX_MS = 30_000;
const ENSURE_FIRST_CONNECTED_ATTEMPTS = 18;

function trimEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v === "" ? undefined : v;
}

function envTruthy(key: string): boolean {
  const v = trimEnv(key);
  if (!v) return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function tlsRejectUnauthorized(): boolean {
  const v = trimEnv("REDIS_TLS_REJECT_UNAUTHORIZED")?.toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

/**
 * TLS for host/port mode. (`rediss://` URLs handle TLS without this.)
 */
function tlsOptionsFromEnv(): ConnectionOptions | undefined {
  if (!envTruthy("REDIS_TLS") && !envTruthy("REDIS_USE_TLS")) return undefined;
  return {
    rejectUnauthorized: tlsRejectUnauthorized(),
  };
}

function parseRedisPort(raw: string | undefined): number {
  const d = raw?.trim();
  if (!d) return REDIS_DEFAULT_PORT;
  const n = Number.parseInt(d, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    console.warn(`[msgf/redis-client] invalid REDIS_PORT "${raw ?? ""}", using ${REDIS_DEFAULT_PORT}`);
    return REDIS_DEFAULT_PORT;
  }
  return n;
}

function tlsFingerprint(): string {
  const opts = tlsOptionsFromEnv();
  if (!opts) return "";
  return opts.rejectUnauthorized === false ? "tls:insecure" : "tls:secure";
}

function redisConfigFingerprint(): string | null {
  const host = trimEnv("REDIS_HOST");
  const url = trimEnv("REDIS_URL");
  if (host) {
    const port = parseRedisPort(trimEnv("REDIS_PORT"));
    const password = trimEnv("REDIS_PASSWORD") ?? "";
    return `host:${host}:${port}:${password}:${tlsFingerprint()}`;
  }
  if (url) return `url:${url}`;
  return null;
}

function redisRetryStrategy(times: number): number | null {
  const attempt = Math.max(1, times);
  const exp = RECONNECT_BASE_DELAY_MS * 2 ** Math.min(attempt - 1, 24);
  return Math.min(exp, RECONNECT_MAX_DELAY_MS);
}

function buildRedisOptions(): RedisOptions {
  const tls = tlsOptionsFromEnv();
  return {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    connectTimeout: CONNECT_TIMEOUT_MS,
    keepAlive: KEEP_ALIVE_MS,
    retryStrategy: redisRetryStrategy,
    reconnectOnError(err: Error): boolean | 1 | 2 {
      const message = err.message ?? "";
      if (message.includes("READONLY")) return true;
      if (message.includes("LOADING")) return true;
      if (message.includes("CLUSTERDOWN")) return true;
      if (message.includes("ECONNRESET")) return true;
      if (message.includes("ECONNREFUSED")) return true;
      if (message.includes("ETIMEDOUT")) return true;
      return false;
    },
    ...(tls ? { tls } : {}),
  };
}

function attachRedisDiagnostics(instance: Redis): void {
  instance.on("error", (err) => {
    console.warn("[msgf/redis-client] error:", err instanceof Error ? err.message : String(err));
  });
  instance.on("reconnecting", (delay: number) => {
    if (delay >= 5_000) {
      console.warn(`[msgf/redis-client] reconnecting in ${delay}ms`);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createRedisFromEnv(): Redis | null {
  const fingerprint = redisConfigFingerprint();
  if (!fingerprint) return null;

  const shared = buildRedisOptions();
  const host = trimEnv("REDIS_HOST");
  let instance: Redis;

  if (host) {
    const port = parseRedisPort(trimEnv("REDIS_PORT"));
    const password = trimEnv("REDIS_PASSWORD");
    instance = new Redis({
      ...shared,
      host,
      port,
      ...(password != null ? { password } : {}),
    });
  } else {
    const url = trimEnv("REDIS_URL")!;
    instance = new Redis(url, shared);
  }

  attachRedisDiagnostics(instance);
  clientFingerprint = fingerprint;
  return instance;
}

export type RedisBackend = "upstash" | "ioredis" | null;

export function activeRedisBackend(): RedisBackend {
  if (isUpstashRedisConfigured()) return "upstash";
  if (redisConfigFingerprint() !== null) return "ioredis";
  return null;
}

export function isRedisConfigured(): boolean {
  return activeRedisBackend() !== null;
}

/**
 * Lazy singleton ioredis client. Returns null when neither `REDIS_HOST` nor `REDIS_URL` is set.
 */
export function getRedisClient(): Redis | null {
  const fingerprint = redisConfigFingerprint();
  if (!fingerprint) return null;

  if (client && clientFingerprint !== fingerprint) {
    void disconnectClientQuietly(client);
    client = null;
    clientFingerprint = null;
  }

  if (!client) {
    client = createRedisFromEnv();
  }

  return client;
}

async function disconnectClientQuietly(r: Redis): Promise<void> {
  try {
    await r.quit();
  } catch {
    r.disconnect();
  }
}

/** Await ready state with exponential backoff (VPC / scale-up cold starts). */
export async function ensureRedisConnected(): Promise<Redis | null> {
  if (isUpstashRedisConfigured()) {
    const ok = await upstashRedisPing();
    return ok ? ({ status: "ready" } as Redis) : null;
  }

  const redis = getRedisClient();
  if (!redis) return null;
  if (redis.status === "ready") return redis;

  let delayMs = ENSURE_FIRST_CONNECTED_BASE_MS;
  for (let attempt = 0; attempt < ENSURE_FIRST_CONNECTED_ATTEMPTS; attempt++) {
    try {
      await redis.ping();
      return redis;
    } catch (err) {
      if (attempt === ENSURE_FIRST_CONNECTED_ATTEMPTS - 1) {
        console.warn(
          "[msgf/redis-client] ping failed after retries:",
          err instanceof Error ? err.message : String(err)
        );
        return null;
      }
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, ENSURE_FIRST_CONNECTED_MAX_MS);
    }
  }
  return null;
}

export async function redisGet(key: string): Promise<string | null> {
  if (isUpstashRedisConfigured()) return upstashRedisGet(key);
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
  if (isUpstashRedisConfigured()) return upstashRedisSet(key, value, ttlSeconds);
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
  if (isUpstashRedisConfigured()) {
    await upstashRedisDel(key);
    return;
  }
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    /* fail-open */
  }
}

/**
 * Bounded wait for first successful ping (Pulse SHARD warm-up). Returns null on timeout or misconfig.
 */
export async function ensureRedisConnectedWithTimeout(
  timeoutMs = Number(process.env.MSGF_REDIS_CONNECT_TIMEOUT_MS || 3_000)
): Promise<Redis | null> {
  if (!isRedisConfigured()) return null;

  if (isUpstashRedisConfigured()) {
    const ok = await upstashRedisPingWithTimeout(timeoutMs);
    return ok ? ({ status: "ready" } as Redis) : null;
  }

  const bounded = Math.max(500, Math.min(timeoutMs, 30_000));

  try {
    return await Promise.race([
      ensureRedisConnected(),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), bounded);
      }),
    ]);
  } catch {
    return null;
  }
}

/** SET key NX with optional TTL. Returns true when the lock was acquired. */
export async function redisSetNx(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<boolean> {
  if (isUpstashRedisConfigured()) return upstashRedisSetNx(key, value, ttlSeconds);
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    const result =
      ttlSeconds != null && ttlSeconds > 0
        ? await redis.set(key, value, "EX", ttlSeconds, "NX")
        : await redis.set(key, value, "NX");
    return result === "OK";
  } catch (err) {
    console.warn("[msgf/redis-client] SET NX failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** INCR with window TTL on first increment. Returns null when Redis unavailable. */
export async function redisIncrWithWindow(
  key: string,
  windowSeconds: number
): Promise<number | null> {
  if (isUpstashRedisConfigured()) return upstashRedisIncrWithWindow(key, windowSeconds);
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1 && windowSeconds > 0) {
      await redis.expire(key, windowSeconds);
    }
    return count;
  } catch (err) {
    console.warn("[msgf/redis-client] INCR failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Test-only: disconnect and clear singleton. */
export async function __resetRedisClientForTests(): Promise<void> {
  __resetUpstashRedisForTests();
  if (client) {
    await disconnectClientQuietly(client);
  }
  client = null;
  clientFingerprint = null;
}
