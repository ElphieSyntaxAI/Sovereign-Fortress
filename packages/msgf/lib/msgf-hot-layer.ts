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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import type { StateBeatRow } from "@/lib/P4";
import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

const ACTIVE_SLICE_TTL_SECONDS = Number(process.env.MSGF_ACTIVE_SLICE_TTL_SEC || 180);
const GATE_VALIDATION_TTL_SECONDS = Number(process.env.MSGF_GATE_VALIDATION_TTL_SEC || 120);

/** When true (default), skip cold Postgres beat fetch on hot slice hit. */
export function isHotLayerPrimaryReadsEnabled(): boolean {
  const v = process.env.MSGF_HOT_LAYER_PRIMARY?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  return true;
}

type ActiveSlicePayload = {
  entityId: string;
  beatsContext: string;
  previousRetryCount: number;
  previousBeats: StateBeatRow[];
  cachedAt: string;
  legalVersion?: string;
  gateValidatedAt?: string;
};

type GateValidationPayload = {
  entityId: string;
  tenantId: string;
  legalVersion: string;
  validatedAt: string;
};

export type HotLayerReadResult = {
  payload: ActiveSlicePayload | null;
  hit: boolean;
  /** Nanoseconds for Redis read (performance.now delta × 1e6). */
  readLatencyNs: number;
  primaryRead: boolean;
};

function activeSliceKey(entityId: string): string {
  return msgfRedisKey("p4", "active-slice", entityId);
}

function gateValidationKey(tenantId: string, entityId: string): string {
  return msgfRedisKey("p4", "gate-valid", tenantId, entityId);
}

function elapsedNs(t0: number): number {
  return Math.round((performance.now() - t0) * 1_000_000);
}

export async function readActiveSliceFast(entityId: string): Promise<HotLayerReadResult> {
  const t0 = performance.now();
  const raw = await redisGet(activeSliceKey(entityId));
  const readLatencyNs = elapsedNs(t0);

  if (!raw) {
    return { payload: null, hit: false, readLatencyNs, primaryRead: false };
  }

  try {
    const parsed = JSON.parse(raw) as ActiveSlicePayload & { authorId?: string };
    if (!parsed.entityId && parsed.authorId) {
      parsed.entityId = parsed.authorId;
    }
    return {
      payload: parsed,
      hit: true,
      readLatencyNs,
      primaryRead: isHotLayerPrimaryReadsEnabled(),
    };
  } catch {
    return { payload: null, hit: false, readLatencyNs, primaryRead: false };
  }
}

/** Legacy alias — returns payload only. */
export async function getActiveSlice(entityId: string): Promise<ActiveSlicePayload | null> {
  const r = await readActiveSliceFast(entityId);
  return r.payload;
}

export async function setActiveSlice(params: {
  entityId: string;
  previousBeats: StateBeatRow[];
  previousRetryCount: number;
  legalVersion?: string;
}): Promise<void> {
  const beatsContext = params.previousBeats.length
    ? params.previousBeats.map((b) => `[${b.sequence_index}] ${b.beat_text}`).join("\n")
    : "(no prior beats)";

  const payload: ActiveSlicePayload = {
    entityId: params.entityId,
    beatsContext,
    previousRetryCount: params.previousRetryCount,
    previousBeats: params.previousBeats,
    cachedAt: new Date().toISOString(),
    legalVersion: params.legalVersion,
    gateValidatedAt: new Date().toISOString(),
  };

  await redisSet(activeSliceKey(params.entityId), JSON.stringify(payload), ACTIVE_SLICE_TTL_SECONDS);
}

/**
 * Fast gate validation stamp — sub-ms Redis round trip when hot layer is up.
 */
export async function validateP4GateFast(params: {
  tenantId: string;
  entityId: string;
  legalVersion: string;
}): Promise<{ ok: boolean; latencyNs: number; cached: boolean }> {
  const t0 = performance.now();
  const key = gateValidationKey(params.tenantId, params.entityId);
  const raw = await redisGet(key);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as GateValidationPayload;
      if (parsed.legalVersion === params.legalVersion) {
        return { ok: true, latencyNs: elapsedNs(t0), cached: true };
      }
    } catch {
      /* fall through to refresh */
    }
  }

  const stamp: GateValidationPayload = {
    entityId: params.entityId,
    tenantId: params.tenantId,
    legalVersion: params.legalVersion,
    validatedAt: new Date().toISOString(),
  };
  await redisSet(key, JSON.stringify(stamp), GATE_VALIDATION_TTL_SECONDS);
  return { ok: true, latencyNs: elapsedNs(t0), cached: false };
}

export const HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS = ACTIVE_SLICE_TTL_SECONDS;
