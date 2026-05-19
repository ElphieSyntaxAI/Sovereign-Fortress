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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * MSGF hot-layer Redis helpers — re-exports {@link ./redis-client} (ioredis).
 */

const KEY_PREFIX = "msgf";

export {
  getRedisClient,
  ensureRedisConnected,
  ensureRedisConnectedWithTimeout,
  isRedisConfigured,
  redisGet,
  redisSet,
  redisSetNx,
  redisIncrWithWindow,
  redisDel,
  __resetRedisClientForTests,
} from "./redis-client";

export function msgfRedisKey(...segments: string[]): string {
  return [KEY_PREFIX, ...segments].join(":");
}
