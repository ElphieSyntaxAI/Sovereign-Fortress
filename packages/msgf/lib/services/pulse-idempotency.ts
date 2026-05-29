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
/**
 * Redis-backed Pulse idempotency — duplicate Idempotency-Key within TTL returns cached JSON.
 */

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

const DEFAULT_TTL_SEC = Number(process.env.MSGF_PULSE_IDEMPOTENCY_TTL_SEC?.trim()) || 120;

export type PulseIdempotencyCached = {
  status: number;
  body: Record<string, unknown>;
};

function idempotencyRedisKey(
  tenantId: string,
  entityId: string,
  idempotencyKey: string
): string {
  const digest = idempotencyKey.slice(0, 200);
  return msgfRedisKey("pulse", "idem", tenantId, entityId, digest);
}

export function isPulseIdempotencyEnabled(): boolean {
  const v = process.env.MSGF_PULSE_IDEMPOTENCY_ENABLED?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return true;
}

function resolveIdempotencyRedisKey(params: {
  tenantId: string;
  entityId: string;
  idempotencyKey: string;
}): string | null {
  const tid = params.tenantId.trim();
  const eid = params.entityId.trim();
  const key = params.idempotencyKey.trim();
  if (!tid || !eid || !key) return null;
  return idempotencyRedisKey(tid, eid, key);
}

export async function getPulseIdempotencyCache(params: {
  tenantId: string;
  entityId: string;
  idempotencyKey: string;
}): Promise<PulseIdempotencyCached | null> {
  if (!isPulseIdempotencyEnabled()) return null;
  const key = resolveIdempotencyRedisKey(params);
  if (!key) return null;

  const raw = await redisGet(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PulseIdempotencyCached;
    if (
      typeof parsed.status === "number" &&
      parsed.body &&
      typeof parsed.body === "object"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function setPulseIdempotencyCache(params: {
  tenantId: string;
  entityId: string;
  idempotencyKey: string;
  status: number;
  body: Record<string, unknown>;
  ttlSec?: number;
}): Promise<void> {
  if (!isPulseIdempotencyEnabled()) return;
  if (params.status < 200 || params.status >= 300) return;

  const key = resolveIdempotencyRedisKey(params);
  if (!key) return;

  const ttl = params.ttlSec ?? DEFAULT_TTL_SEC;
  await redisSet(
    key,
    JSON.stringify({ status: params.status, body: params.body }),
    ttl
  );
}
