/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  REPUTATION_BOOST_THRESHOLD,
  REPUTATION_PRUNE_THRESHOLD,
  AttributionClassSchema,
  blocksAutoGreen,
  computeReputationScore,
  hashSourceChunk,
  resourceKeyForFile,
  resourceKeyForVaultHall,
  type SourceHit,
} from "../lib/schemas/source-audit.ts";
import { applyReputationToHits } from "../lib/services/source-audit.ts";

describe("p7 source-audit schemas", () => {
  test("hashSourceChunk normalizes CRLF and trailing whitespace", () => {
    const a = hashSourceChunk("hello\r\nworld  ");
    const b = hashSourceChunk("hello\nworld");
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  test("resource keys are stable", () => {
    assert.equal(
      resourceKeyForVaultHall("11111111-1111-1111-1111-111111111111", "vault"),
      "vault:11111111-1111-1111-1111-111111111111"
    );
    assert.equal(
      resourceKeyForFile("docs\\auth.md"),
      resourceKeyForFile("docs/auth.md")
    );
  });

  test("computeReputationScore clamps and weights high drift", () => {
    assert.equal(computeReputationScore(10, 0, 0), 1);
    assert.ok(computeReputationScore(0, 10, 0) <= -1 + 1e-9);
    const mixed = computeReputationScore(2, 1, 2);
    assert.ok(mixed > -1 && mixed < 1);
  });

  test("blocksAutoGreen for copyleft and untrusted", () => {
    assert.equal(
      blocksAutoGreen({ attribution_class: "copyleft_risk" }),
      true
    );
    assert.equal(
      blocksAutoGreen({ attribution_class: "untrusted_external" }),
      true
    );
    assert.equal(blocksAutoGreen({ attribution_class: "unknown" }), false);
    assert.equal(
      blocksAutoGreen({ attribution_class: "copyleft_risk", pruned: true }),
      false
    );
    assert.equal(AttributionClassSchema.parse("internal_spec"), "internal_spec");
  });
});

describe("p7 applyReputationToHits", () => {
  test("boosts and prunes by thresholds", () => {
    const hits: SourceHit[] = [
      {
        kind: "vault",
        resource_key: "vault:good",
        score: 0.4,
        attribution_class: "unknown",
      },
      {
        kind: "vault",
        resource_key: "vault:bad",
        score: 0.5,
        attribution_class: "unknown",
      },
    ];
    const rep = new Map<string, number>([
      ["vault:good", REPUTATION_BOOST_THRESHOLD + 0.1],
      ["vault:bad", REPUTATION_PRUNE_THRESHOLD - 0.1],
    ]);
    const { contextHits, prunedHits, forceEscalate } = applyReputationToHits(
      hits,
      rep
    );
    assert.equal(forceEscalate, false);
    assert.equal(prunedHits.length, 1);
    assert.equal(prunedHits[0]?.resource_key, "vault:bad");
    assert.equal(contextHits.length, 1);
    assert.ok((contextHits[0]?.score ?? 0) > 0.4);
  });

  test("forces escalate on copyleft in context", () => {
    const hits: SourceHit[] = [
      {
        kind: "file",
        resource_key: "file:abc",
        score: 0.6,
        attribution_class: "copyleft_risk",
      },
    ];
    const { forceEscalate, escalateReason } = applyReputationToHits(
      hits,
      new Map()
    );
    assert.equal(forceEscalate, true);
    assert.match(escalateReason ?? "", /copyleft_risk/);
  });
});
