/**
 * Hash-chain + HMAC helpers for offline sealed HAL batches (Node).
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const HAL_OFFLINE_GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export const HAL_OFFLINE_MAX_HOURS = 48;
export const HAL_OFFLINE_MAX_EVENTS = 50_000;
export const HAL_OFFLINE_MAX_BATCHES = 200;
export const HAL_OFFLINE_CLOCK_SKEW_MS = 10 * 60 * 1000;

export type SealedHalBatch = {
  batch_id: string;
  prev_hash: string;
  batch_hash: string;
  hmac: string;
  started_at: string;
  ended_at: string;
  event_count: number;
  events: unknown[];
  content_fingerprint?: string | null;
  word_count_estimate?: number;
};

export function hashSha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function generateLeaseSecret(): string {
  return randomBytes(32).toString("hex");
}

export function hashLeaseSecret(secret: string): string {
  return hashSha256Hex(secret);
}

export function canonicalEventsDigest(events: unknown[]): string {
  return hashSha256Hex(JSON.stringify(events));
}

/** Canonical payload hashed into batch_hash (must match extension). */
export function computeBatchHash(input: {
  batch_id: string;
  prev_hash: string;
  started_at: string;
  ended_at: string;
  event_count: number;
  events: unknown[];
  lease_id: string;
  manuscript_id: string;
  content_fingerprint?: string | null;
}): string {
  const payload = {
    batch_id: input.batch_id,
    prev_hash: input.prev_hash,
    started_at: input.started_at,
    ended_at: input.ended_at,
    event_count: input.event_count,
    events_digest: canonicalEventsDigest(input.events),
    lease_id: input.lease_id,
    manuscript_id: input.manuscript_id,
    content_fingerprint: input.content_fingerprint ?? null,
  };
  return hashSha256Hex(JSON.stringify(payload));
}

export function hmacBatchHash(secret: string, batchHash: string): string {
  return createHmac("sha256", secret).update(batchHash).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export type SealVerifyFailure =
  | "bad_batch_shape"
  | "event_count_mismatch"
  | "bad_batch_hash"
  | "bad_hmac"
  | "chain_break"
  | "duplicate_batch_id";

export function verifySealedBatchChain(input: {
  leaseId: string;
  manuscriptId: string;
  secret: string;
  batches: SealedHalBatch[];
  genesisPrevHash?: string;
}): { ok: true } | { ok: false; code: SealVerifyFailure; detail: string } {
  const genesis = input.genesisPrevHash ?? HAL_OFFLINE_GENESIS_HASH;
  let expectedPrev = genesis;
  const seen = new Set<string>();

  for (let i = 0; i < input.batches.length; i++) {
    const b = input.batches[i];
    if (!b || typeof b !== "object") {
      return { ok: false, code: "bad_batch_shape", detail: `Batch ${i} missing` };
    }
    if (!b.batch_id || !b.batch_hash || !b.hmac || !Array.isArray(b.events)) {
      return { ok: false, code: "bad_batch_shape", detail: `Batch ${i} incomplete` };
    }
    if (seen.has(b.batch_id)) {
      return { ok: false, code: "duplicate_batch_id", detail: b.batch_id };
    }
    seen.add(b.batch_id);

    if (b.event_count !== b.events.length) {
      return {
        ok: false,
        code: "event_count_mismatch",
        detail: `${b.batch_id}: count ${b.event_count} vs events ${b.events.length}`,
      };
    }

    if (b.prev_hash !== expectedPrev) {
      return {
        ok: false,
        code: "chain_break",
        detail: `${b.batch_id}: expected prev ${expectedPrev.slice(0, 12)}…`,
      };
    }

    const computed = computeBatchHash({
      batch_id: b.batch_id,
      prev_hash: b.prev_hash,
      started_at: b.started_at,
      ended_at: b.ended_at,
      event_count: b.event_count,
      events: b.events,
      lease_id: input.leaseId,
      manuscript_id: input.manuscriptId,
      content_fingerprint: b.content_fingerprint,
    });

    if (!safeEqualHex(computed, b.batch_hash)) {
      return { ok: false, code: "bad_batch_hash", detail: b.batch_id };
    }

    const mac = hmacBatchHash(input.secret, b.batch_hash);
    if (!safeEqualHex(mac, b.hmac)) {
      return { ok: false, code: "bad_hmac", detail: b.batch_id };
    }

    expectedPrev = b.batch_hash;
  }

  return { ok: true };
}

export function latenciesFromSealedEvents(events: unknown[]): number[] {
  const out: number[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (e.isSystemEvent === true || e.key === "PASTE_EVENT") continue;
    const ft = Number(e.flightTime ?? e.flightMs);
    if (Number.isFinite(ft) && ft >= 0) out.push(Math.round(ft));
  }
  return out.length > 0 ? out : [120];
}

export function eventsAsDna(events: unknown[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    out.push(raw as Record<string, unknown>);
  }
  return out;
}
