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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BRAIN_FEATURE_CATALOG,
  classifyPulseRoutingBrain,
  DEV_EVENT_LOGIC_DELTA_SOURCE,
  MSGF_BRAIN_BIG,
  MSGF_BRAIN_SMALL,
  savingsCatalogFeatureIdToBrainId,
} from "../lib/services/brain-routing-policy.js";
import { routeDevEventBuildFailure } from "../lib/services/dev-event-routing.js";
import { DevEventBodySchema } from "../lib/schemas/dev-event.js";
import { buildSavingsFeatureCatalog } from "../lib/services/savings-features-stats.js";

describe("brain-routing-policy", () => {
  test("routine pulse routing classifies as Small Brain", () => {
    const c = classifyPulseRoutingBrain("local_gateway");
    assert.equal(c.tier, MSGF_BRAIN_SMALL);
    assert.equal(c.feature_id, "pulse_local_gateway");
  });

  test("global CONVERGE classifies as Big Brain", () => {
    const c = classifyPulseRoutingBrain("global_converge");
    assert.equal(c.tier, MSGF_BRAIN_BIG);
    assert.equal(c.feature_id, "pulse_global_converge");
  });

  test("dev-event routing is Small Brain without admin gate", () => {
    const body = DevEventBodySchema.parse({
      kind: "build_failed",
      activeFile: "src/a.ts",
      excerpt: "error TS2322",
      exitCode: 1,
      tenantId: "DEV_TEST",
    });
    const r = routeDevEventBuildFailure(body);
    assert.equal(r.brain_tier, MSGF_BRAIN_SMALL);
    assert.equal(r.global_admin_approval_required, false);
  });

  test("savings catalog marks efficiency features as Small Brain; admin paths as Big Brain", () => {
    const catalog = buildSavingsFeatureCatalog();
    const dev = catalog.find((e) => e.id === "dev_event");
    assert.ok(dev);
    assert.equal(dev.brain_tier, MSGF_BRAIN_SMALL);
    assert.equal(dev.requires_admin_for_global, false);

    const verify = catalog.find((e) => e.id === "verify_result");
    assert.ok(verify);
    assert.equal(verify.brain_tier, MSGF_BRAIN_SMALL);

    const big = catalog.find((e) => e.id === "big_brain_admin_promotion");
    assert.ok(big);
    assert.equal(big.brain_tier, MSGF_BRAIN_BIG);
    assert.equal(big.requires_admin_for_global, true);
  });

  test("DEV_EVENT logic delta source is registered", () => {
    assert.equal(DEV_EVENT_LOGIC_DELTA_SOURCE, "dev_event");
    const brainId = savingsCatalogFeatureIdToBrainId("dev_event");
    assert.equal(brainId, "dev_event_heal_cheap");
    const row = BRAIN_FEATURE_CATALOG.find((f) => f.id === brainId);
    assert.equal(row?.tier, MSGF_BRAIN_SMALL);
  });
});
