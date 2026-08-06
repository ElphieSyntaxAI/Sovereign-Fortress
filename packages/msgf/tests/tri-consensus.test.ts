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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BIG_BRAIN_DEFAULT,
  SMALL_BRAIN_DEFAULT,
  configFromTenantPreset,
  resolveHumanNotifyThreshold,
  validateConsensusConfig,
} from "../lib/services/consensus/msgf-consensus-config.ts";
import {
  decideConsensusVote,
  shouldNotifyHuman,
  tallyVotes,
} from "../lib/services/consensus/majority-vote.ts";

describe("validateConsensusConfig", () => {
  test("accepts BIG and SMALL defaults", () => {
    assert.equal(validateConsensusConfig(BIG_BRAIN_DEFAULT).ok, true);
    assert.equal(validateConsensusConfig(SMALL_BRAIN_DEFAULT).ok, true);
  });

  test("rejects wrong provider counts", () => {
    assert.equal(
      validateConsensusConfig({
        mode: "TRI",
        providers: ["anthropic", "google"],
        strictness: "MAJORITY",
      }).ok,
      false
    );
    assert.equal(
      validateConsensusConfig({
        mode: "DUAL",
        providers: ["anthropic"],
        strictness: "UNANIMOUS",
      }).ok,
      false
    );
    assert.equal(
      validateConsensusConfig({
        mode: "SOLO_FAST",
        providers: ["anthropic", "google"],
        strictness: "UNANIMOUS",
      }).ok,
      false
    );
  });

  test("rejects duplicate providers", () => {
    const v = validateConsensusConfig({
      mode: "DUAL",
      providers: ["anthropic", "anthropic"],
      strictness: "UNANIMOUS",
    });
    assert.equal(v.ok, false);
  });
});

describe("configFromTenantPreset", () => {
  test("balanced_dual and bias_mitigated_dual", () => {
    const a = configFromTenantPreset("balanced_dual");
    assert.ok(!("error" in a));
    assert.deepEqual(a.providers, ["anthropic", "google"]);

    const b = configFromTenantPreset("bias_mitigated_dual");
    assert.ok(!("error" in b));
    assert.deepEqual(b.providers, ["anthropic", "xai"]);
  });

  test("custom_byok dual vs tri", () => {
    const dual = configFromTenantPreset("custom_byok", ["google", "xai"]);
    assert.ok(!("error" in dual));
    assert.equal(dual.mode, "DUAL");
    assert.equal(dual.strictness, "UNANIMOUS");

    const tri = configFromTenantPreset("custom_byok", ["anthropic", "google", "xai"]);
    assert.ok(!("error" in tri));
    assert.equal(tri.mode, "TRI");
    assert.equal(tri.strictness, "MAJORITY");
  });
});

describe("majority vote", () => {
  test("2-of-3 HUMAN majority does not require HITL", () => {
    const d = decideConsensusVote(["HUMAN", "HUMAN", "NON_HUMAN"], "MAJORITY");
    assert.equal(d.ok, true);
    if (d.ok) assert.equal(d.decision, "HUMAN_CONFIRMED");
  });

  test("all different → no_majority", () => {
    const d = decideConsensusVote(["HUMAN", "NON_HUMAN", "INCONCLUSIVE"], "MAJORITY");
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.reason, "no_majority");
  });

  test("UNANIMOUS fails on split", () => {
    const d = decideConsensusVote(["HUMAN", "NON_HUMAN"], "UNANIMOUS");
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.reason, "unanimous_fail");
  });

  test("tallyVotes need ceil for 2-of-3", () => {
    const t = tallyVotes(["HUMAN", "HUMAN", "NON_HUMAN"]);
    assert.equal(t.majorityLabel, "HUMAN");
    assert.equal(t.no_majority, false);
    assert.equal(t.HUMAN, 2);
  });
});

describe("shouldNotifyHuman", () => {
  const base = {
    voteOk: true,
    majorityLabel: "HUMAN" as const,
    securityNonHuman: false,
    halScore: 90,
    allHumanConfirmed: true,
  };

  test("model majority + low drift → no notify", () => {
    assert.equal(
      shouldNotifyHuman({
        ...base,
        logicDriftScore: 0.35,
        humanNotifyThreshold: 0.45,
      }),
      false
    );
  });

  test("high original drift → notify even with majority", () => {
    assert.equal(
      shouldNotifyHuman({
        ...base,
        logicDriftScore: 0.5,
        humanNotifyThreshold: 0.45,
      }),
      true
    );
  });

  test("no_majority → notify", () => {
    assert.equal(
      shouldNotifyHuman({
        ...base,
        voteOk: false,
        majorityLabel: null,
        allHumanConfirmed: false,
        logicDriftScore: 0.2,
        humanNotifyThreshold: 0.45,
      }),
      true
    );
  });

  test("NON_HUMAN majority → notify", () => {
    assert.equal(
      shouldNotifyHuman({
        ...base,
        majorityLabel: "NON_HUMAN",
        allHumanConfirmed: false,
        logicDriftScore: 0.2,
        humanNotifyThreshold: 0.45,
      }),
      true
    );
  });
});

describe("resolveHumanNotifyThreshold", () => {
  test("defaults to 0.45 and clamps", () => {
    assert.equal(resolveHumanNotifyThreshold(null), 0.45);
    assert.equal(resolveHumanNotifyThreshold("0.5"), 0.5);
    assert.equal(resolveHumanNotifyThreshold("0.1"), 0.3);
    assert.equal(resolveHumanNotifyThreshold("1.5"), 0.95);
  });
});
