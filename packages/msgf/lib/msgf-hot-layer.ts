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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import type { StateBeatRow } from "@/lib/P4";
import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

const ACTIVE_SLICE_TTL_SECONDS = Number(process.env.MSGF_ACTIVE_SLICE_TTL_SEC || 180);

type ActiveSlicePayload = {
  entityId: string;
  beatsContext: string;
  previousRetryCount: number;
  previousBeats: StateBeatRow[];
  cachedAt: string;
};

function activeSliceKey(entityId: string): string {
  return msgfRedisKey("p4", "active-slice", entityId);
}

export async function getActiveSlice(entityId: string): Promise<ActiveSlicePayload | null> {
  const raw = await redisGet(activeSliceKey(entityId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ActiveSlicePayload & { authorId?: string };
    if (!parsed.entityId && parsed.authorId) {
      return { ...parsed, entityId: parsed.authorId };
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setActiveSlice(params: {
  entityId: string;
  previousBeats: StateBeatRow[];
  previousRetryCount: number;
}): Promise<void> {
  const beatsContext = params.previousBeats.length
    ? params.previousBeats
        .map((b) => `[${b.sequence_index}] ${b.beat_text}`)
        .join("\n")
    : "(no prior beats)";

  const payload: ActiveSlicePayload = {
    entityId: params.entityId,
    beatsContext,
    previousRetryCount: params.previousRetryCount,
    previousBeats: params.previousBeats,
    cachedAt: new Date().toISOString(),
  };

  await redisSet(activeSliceKey(params.entityId), JSON.stringify(payload), ACTIVE_SLICE_TTL_SECONDS);
}

export const HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS = ACTIVE_SLICE_TTL_SECONDS;
