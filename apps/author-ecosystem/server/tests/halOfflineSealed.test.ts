import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeBatchHash,
  hmacBatchHash,
  HAL_OFFLINE_GENESIS_HASH,
  verifySealedBatchChain,
  generateLeaseSecret,
  hashLeaseSecret,
  safeEqualHex,
} from "../src/lib/halOfflineSeal.js";
import { runHalTamperChecks } from "../src/lib/halTamperChecks.js";

describe("halOfflineSeal", () => {
  it("verifies a single sealed batch chain", () => {
    const secret = generateLeaseSecret();
    const leaseId = "11111111-1111-1111-1111-111111111111";
    const manuscriptId = "ms-1";
    const events = [
      { key: "a", timestamp: "2026-09-14T12:00:00.000Z", flightTime: 120 },
      { key: "b", timestamp: "2026-09-14T12:00:01.000Z", flightTime: 140 },
    ];
    const batch_id = "22222222-2222-2222-2222-222222222222";
    const prev_hash = HAL_OFFLINE_GENESIS_HASH;
    const started_at = "2026-09-14T12:00:00.000Z";
    const ended_at = "2026-09-14T12:00:01.000Z";
    const batch_hash = computeBatchHash({
      batch_id,
      prev_hash,
      started_at,
      ended_at,
      event_count: events.length,
      events,
      lease_id: leaseId,
      manuscript_id: manuscriptId,
    });
    const hmac = hmacBatchHash(secret, batch_hash);
    const ok = verifySealedBatchChain({
      leaseId,
      manuscriptId,
      secret,
      batches: [
        {
          batch_id,
          prev_hash,
          batch_hash,
          hmac,
          started_at,
          ended_at,
          event_count: events.length,
          events,
        },
      ],
    });
    assert.equal(ok.ok, true);
  });

  it("rejects tampered hmac", () => {
    const secret = generateLeaseSecret();
    const leaseId = "11111111-1111-1111-1111-111111111111";
    const manuscriptId = "ms-1";
    const events = [{ key: "a", timestamp: "2026-09-14T12:00:00.000Z", flightTime: 120 }];
    const batch_id = "22222222-2222-2222-2222-222222222222";
    const prev_hash = HAL_OFFLINE_GENESIS_HASH;
    const started_at = "2026-09-14T12:00:00.000Z";
    const ended_at = "2026-09-14T12:00:00.500Z";
    const batch_hash = computeBatchHash({
      batch_id,
      prev_hash,
      started_at,
      ended_at,
      event_count: 1,
      events,
      lease_id: leaseId,
      manuscript_id: manuscriptId,
    });
    const bad = verifySealedBatchChain({
      leaseId,
      manuscriptId,
      secret,
      batches: [
        {
          batch_id,
          prev_hash,
          batch_hash,
          hmac: hmacBatchHash("deadbeef", batch_hash),
          started_at,
          ended_at,
          event_count: 1,
          events,
        },
      ],
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.code, "bad_hmac");
  });

  it("hashes lease secrets stably", () => {
    const s = generateLeaseSecret();
    assert.equal(safeEqualHex(hashLeaseSecret(s), hashLeaseSecret(s)), true);
  });
});

describe("halTamperChecks", () => {
  it("passes honest varied typing", () => {
    const latencyMs = Array.from({ length: 50 }, (_, i) => 80 + (i % 7) * 15);
    const events = latencyMs.map((flightTime, i) => ({
      key: "x",
      timestamp: new Date(Date.now() - (50 - i) * 1000).toISOString(),
      flightTime,
    }));
    const r = runHalTamperChecks({
      locale: "en",
      latencyMs,
      events,
      claimedTypedWords: 40,
      contentDelta: "The quick brown fox jumps over the lazy dog again and again.",
    });
    assert.equal(r.ok, true);
  });

  it("hard-rejects robot-flat rhythm", () => {
    const latencyMs = Array.from({ length: 50 }, () => 100);
    const r = runHalTamperChecks({
      locale: "en",
      latencyMs,
      events: latencyMs.map((flightTime) => ({ key: "x", flightTime })),
      claimedTypedWords: 40,
      contentDelta: "hello world ".repeat(20),
    });
    assert.equal(r.ok, false);
    assert.ok(r.hard.includes("impossible_rhythm_flat"));
  });

  it("hard-rejects paste-as-typing", () => {
    const r = runHalTamperChecks({
      locale: "en",
      latencyMs: [120, 130],
      events: [
        { key: "a", flightTime: 120 },
        { key: "b", flightTime: 130 },
        { key: "PASTE_EVENT", isSystemEvent: true, wordsPasted: 200 },
      ],
      claimedTypedWords: 180,
      contentDelta: "x".repeat(50),
    });
    assert.equal(r.ok, false);
    assert.ok(r.hard.includes("paste_as_typing"));
  });

  it("allows past ended_at after offline focus writing", () => {
    const startedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const endedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const latencyMs = Array.from({ length: 50 }, (_, i) => 90 + (i % 5) * 20);
    const r = runHalTamperChecks({
      locale: "en",
      latencyMs,
      events: latencyMs.map((flightTime, i) => ({
        key: "x",
        timestamp: new Date(startedAt.getTime() + i * 1000).toISOString(),
        flightTime,
      })),
      claimedTypedWords: 40,
      contentDelta: "Honest offline prose for focus mode writing session.",
      startedAt,
      endedAt,
      serverNow: new Date(),
    });
    assert.equal(r.ok, true);
  });
});
