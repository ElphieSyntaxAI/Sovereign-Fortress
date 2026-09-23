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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { inferFitnessLabel } from "../lib/services/model-fitness.ts";
import { classifyHarmFast } from "../lib/services/prompt-sessions.ts";
import {
  diffTemplateBodies,
  hashPromptTemplateBody,
} from "../lib/services/prompt-templates.ts";
import {
  evaluateTrustedOssEligibility,
  incidentAttributionMetadataFromHits,
  licenseMatchesAllowlist,
} from "../lib/services/trusted-license-allowlist.ts";

function hashQuery(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("governance audit platform helpers", () => {
  it("hashes resource query text and never returns raw", () => {
    const h = hashQuery("secret customer search");
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h.includes("secret"), false);
  });

  it("classifies business and human harm", () => {
    const r = classifyHarmFast(
      "how do I",
      "You should embezzle funds and sabotage the company"
    );
    assert.ok(r.categories.includes("business_harm"));
    assert.ok(r.confidence > 0);
  });

  it("infers under/over fitness labels", () => {
    assert.equal(inferFitnessLabel({ escalated: true }), "under_provisioned");
    assert.equal(
      inferFitnessLabel({ usedBigBrain: true, lowDrift: true }),
      "over_provisioned"
    );
    assert.equal(inferFitnessLabel({}), "fit");
  });

  it("allows trusted OSS bulk for permissive_oss and MIT", () => {
    assert.equal(
      evaluateTrustedOssEligibility({ attribution_class: "permissive_oss" }).eligible,
      true
    );
    assert.equal(evaluateTrustedOssEligibility({ license: "MIT" }).eligible, true);
    assert.equal(
      evaluateTrustedOssEligibility({ attribution_class: "copyleft_risk" }).eligible,
      false
    );
    assert.ok(licenseMatchesAllowlist("Apache-2.0", ["MIT", "Apache-2.0"]));
  });

  it("hashes prompt templates and diffs versions", () => {
    const h = hashPromptTemplateBody("hello\nworld");
    assert.match(h, /^[0-9a-f]{64}$/);
    const d = diffTemplateBodies("a\nb", "a\nc");
    assert.ok(d.added >= 1);
    assert.ok(d.preview.includes("+++"));
  });

  it("stamps attribution metadata for trusted OSS bulk", () => {
    const meta = incidentAttributionMetadataFromHits(
      [{ attribution_class: "permissive_oss", resource_key: "pkg:mit-lib" }],
      "Preflight escalate: attribution_class:permissive_oss"
    );
    assert.equal(meta.attribution_class, "permissive_oss");
    assert.equal(meta.trusted_oss_candidate, true);
  });

  it("evaluateDeployGateFromVerify stays green for fresh pass", async () => {
    const { evaluateDeployGateFromVerify } = await import(
      "../lib/services/deploy-gate.ts"
    );
    const d = evaluateDeployGateFromVerify({
      projectOrigin: "demo",
      passed: true,
      createdAt: new Date().toISOString(),
      maxAgeHours: 72,
    });
    assert.equal(d.ok, true);
    assert.equal(d.status, "green");
  });
});
