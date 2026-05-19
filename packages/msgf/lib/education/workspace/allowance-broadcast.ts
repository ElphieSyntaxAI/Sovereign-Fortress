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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * Layer B realtime broadcast — Redis pub/sub + key cache (Layer A unaffected).
 */
import {
  AI_ALLOWANCE_LEVEL_NAMES,
  resolveLayerBFlags,
  type AiAllowanceLevel,
  type LayerBAllowanceEvent,
} from "@elphie-syntax/core";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

const ALLOWANCE_CACHE_TTL_SEC = Number(
  process.env.MSGF_EDUCATION_ALLOWANCE_CACHE_TTL_SEC || 86400
);

function allowanceChannel(assignmentId: string): string {
  return msgfRedisKey("education", "allowance", assignmentId);
}

function allowanceCacheKey(assignmentId: string): string {
  return msgfRedisKey("education", "allowance-cache", assignmentId);
}

export function buildLayerBAllowanceEvent(
  assignmentId: string,
  level: AiAllowanceLevel
): LayerBAllowanceEvent {
  const flags = resolveLayerBFlags(level);
  return {
    type: "layer_b_allowance_updated",
    assignmentId,
    aiAllowanceLevel: level,
    levelName: AI_ALLOWANCE_LEVEL_NAMES[level],
    flags,
    updatedAt: new Date().toISOString(),
  };
}

export async function cacheAssignmentAllowance(
  assignmentId: string,
  level: AiAllowanceLevel
): Promise<LayerBAllowanceEvent> {
  const event = buildLayerBAllowanceEvent(assignmentId, level);
  await redisSet(
    allowanceCacheKey(assignmentId),
    JSON.stringify(event),
    ALLOWANCE_CACHE_TTL_SEC
  );
  return event;
}

export async function readCachedAssignmentAllowance(
  assignmentId: string
): Promise<LayerBAllowanceEvent | null> {
  const raw = await redisGet(allowanceCacheKey(assignmentId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LayerBAllowanceEvent;
  } catch {
    return null;
  }
}

/** Publish Layer B update — subscribers refresh chat shell only. */
export async function publishLayerBAllowanceUpdate(
  assignmentId: string,
  level: AiAllowanceLevel
): Promise<LayerBAllowanceEvent> {
  const event = await cacheAssignmentAllowance(assignmentId, level);

  if (!isRedisConfigured()) {
    return event;
  }

  const redis = getRedisClient();
  if (!redis) return event;

  await redis.publish(allowanceChannel(assignmentId), JSON.stringify(event));
  return event;
}

export function allowancePubSubChannel(assignmentId: string): string {
  return allowanceChannel(assignmentId);
}
