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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Gateway completion cache (prompt-hash) — separate from CONVERGE consensus cache.
 */

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import type { ActiveAggressiveness } from "@/lib/gateway/tenant-policy";

const TTL_SEC = Number(process.env.MSGF_GATEWAY_COMPLETION_CACHE_TTL_SEC?.trim()) || 3600;

export type GatewayCachedCompletion = {
  text: string;
  model: string;
  promptHash: string;
  storedAt: number;
};

export function buildGatewayCompletionCacheKey(
  tenantId: string,
  promptHash: string,
  aggressiveness: ActiveAggressiveness
): string {
  return msgfRedisKey(
    "gateway-completion",
    tenantId.trim(),
    aggressiveness,
    promptHash
  );
}

export async function getGatewayCompletionCache(
  tenantId: string,
  promptHash: string,
  aggressiveness: ActiveAggressiveness
): Promise<GatewayCachedCompletion | null> {
  const key = buildGatewayCompletionCacheKey(tenantId, promptHash, aggressiveness);
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GatewayCachedCompletion;
    if (
      parsed &&
      typeof parsed.text === "string" &&
      typeof parsed.promptHash === "string"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function setGatewayCompletionCache(
  tenantId: string,
  promptHash: string,
  aggressiveness: ActiveAggressiveness,
  completion: { text: string; model: string }
): Promise<void> {
  if (!completion.text.trim()) return;
  const key = buildGatewayCompletionCacheKey(tenantId, promptHash, aggressiveness);
  const payload: GatewayCachedCompletion = {
    text: completion.text,
    model: completion.model,
    promptHash,
    storedAt: Date.now(),
  };
  await redisSet(key, JSON.stringify(payload), TTL_SEC);
}
