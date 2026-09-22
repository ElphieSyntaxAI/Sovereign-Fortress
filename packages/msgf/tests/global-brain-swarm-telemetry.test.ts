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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  CURRENT_LEGAL_VERSION,
  PLATFORM_PLEDGE,
  PROMPT_SESSION_RETENTION_NOTICE,
} from "../lib/msgf-legal.ts";
import { auditEventMatchesQuery } from "../lib/services/emit-platform-audit.ts";
import {
  buildGlobalBrainSwarmTelemetry,
  composeSwarmCauseCode,
  dpCountSwarmComposites,
  globalBrainTelemetryHasStrippedKeys,
} from "../lib/services/global-brain-swarm-telemetry.ts";
import { SWARM_CAUSE_CODES } from "../lib/services/swarm-fix-catalog.ts";
import {
  replaySyntheticSwarmCase,
  SYNTHETIC_MANDATE_PREFIX,
} from "../lib/services/swarm-synthetic-catalog.ts";
import {
  createMemorySwarmStore,
  evaluateSwarmAdmission,
  hashMandate,
  resetMemorySwarmStore,
  type SwarmAgentIdentity,
} from "../lib/services/swarm-guard.ts";

afterEach(() => {
  resetMemorySwarmStore();
  delete process.env.MSGF_SWARM_MAX_INFLIGHT;
  delete process.env.MSGF_SWARM_ENTITY_MAX;
  delete process.env.MSGF_SWARM_FANOUT_MAX;
  delete process.env.MSGF_SWARM_DP_EPSILON;
});

function identity(
  partial: Partial<SwarmAgentIdentity> & Pick<SwarmAgentIdentity, "agentId" | "role">
): SwarmAgentIdentity {
  return {
    parentAgentId: null,
    mandateHash: null,
    entityId: partial.entityId ?? partial.agentId,
    tenantId: "t-global-brain",
    ...partial,
  };
}

describe("global-brain swarm telemetry", () => {
  test("mandate-mismatch envelope is zero-text with drift factors and catalog fixes", async () => {
    const store = createMemorySwarmStore();
    const userPrompt = "The subagent was asked to write a medical summary for Patient X";
    const mandate = hashMandate(userPrompt);
    await evaluateSwarmAdmission({
      identity: identity({
        agentId: "parent-1",
        role: "primary",
        mandateHash: mandate,
      }),
      store,
    });
    const trip = await evaluateSwarmAdmission({
      identity: identity({
        agentId: "child-1",
        role: "secondary",
        parentAgentId: "parent-1",
        mandateHash: hashMandate("other task"),
        entityId: "child-e",
      }),
      store,
    });
    assert.equal(trip.ok, false);
    if (trip.ok) return;

    const telemetry = buildGlobalBrainSwarmTelemetry({
      trip,
      tokensIn: 4000,
      tokensOut: 200,
      logicDrift: {
        score: 0.42,
        escalateToGlobalBrain: true,
        factors: {
          vault_contradiction: 0.45,
          shadow_tier: 0,
          hal_penalty: 0.1,
          biometric_drift: 0,
          text_entropy: 0.12,
        },
      },
    });

    assert.equal(telemetry.kind, "bot_swarm_detected");
    assert.equal(telemetry.enforced, true);
    assert.ok(telemetry.cause_codes.includes("mandate_mismatch"));
    assert.match(telemetry.cause_composite, /MANDATE_MISMATCH/);
    assert.ok(telemetry.spawn_depth >= 1);
    assert.equal(telemetry.parent_child_edge, true);
    assert.equal(telemetry.primary_fix_id, "narrow_mandate");
    assert.equal(telemetry.suggested_fixes[0]?.id, "narrow_mandate");
    assert.ok(telemetry.suggested_fixes.length >= 1);
    assert.equal(telemetry.token_burn, 4200);
    assert.equal(telemetry.drift.escalate_to_global_brain, true);
    assert.equal(telemetry.drift.factors?.vault_contradiction, 0.45);
    assert.equal(telemetry.mandate_sha256, hashMandate("other task"));
    assert.equal(globalBrainTelemetryHasStrippedKeys(telemetry).length, 0);

    const blob = JSON.stringify(telemetry);
    assert.equal(blob.includes(userPrompt), false);
    assert.equal(blob.includes("Patient X"), false);
    assert.equal(blob.includes("parent-1"), false);
    assert.equal(blob.includes("child-1"), false);
    assert.equal(blob.includes("t-global-brain"), false);
  });

  test("composite joins multiple cause codes", () => {
    assert.equal(
      composeSwarmCauseCode(["mandate_mismatch", "fanout_exceeded"]),
      "MANDATE_MISMATCH+FANOUT_EXCEEDED"
    );
  });

  test("audit q=swarm still matches bot_swarm_detected metadata", () => {
    assert.equal(
      auditEventMatchesQuery(
        {
          kind: "bot_swarm_detected",
          summary: "bot_swarm_detected: fanout_exceeded",
          metadata: {
            cause_codes: ["fanout_exceeded"],
            cause_composite: "FANOUT_EXCEEDED",
            suggested_fix_id: "cap_inflight",
          },
        },
        "swarm"
      ),
      true
    );
  });

  test("every synthetic cause replays to that cause without user text", async () => {
    for (const cause of SWARM_CAUSE_CODES) {
      const row = await replaySyntheticSwarmCase(cause);
      assert.equal(row.synthetic_id, `synth_${cause}`);
      assert.ok(row.synthetic_mandate.startsWith(SYNTHETIC_MANDATE_PREFIX));
      assert.ok(row.telemetry.cause_codes.includes(cause));
      assert.equal(globalBrainTelemetryHasStrippedKeys(row.telemetry).length, 0);
      const blob = JSON.stringify(row.telemetry);
      assert.equal(blob.includes("Patient"), false);
      assert.equal(blob.includes(row.synthetic_mandate), false);
    }
  });

  test("dp counts drop composites below k and keep those at k", () => {
    const rows = dpCountSwarmComposites(
      [
        { silo_ref: "a", cause_composite: "MANDATE_MISMATCH" },
        { silo_ref: "b", cause_composite: "MANDATE_MISMATCH" },
        { silo_ref: "c", cause_composite: "FANOUT_EXCEEDED" },
        { silo_ref: "d", cause_composite: "FANOUT_EXCEEDED" },
        { silo_ref: "e", cause_composite: "FANOUT_EXCEEDED" },
        { silo_ref: "f", cause_composite: "FANOUT_EXCEEDED" },
        { silo_ref: "g", cause_composite: "FANOUT_EXCEEDED" },
      ],
      { k: 5, epsilon: null }
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.cause_composite, "FANOUT_EXCEEDED");
    assert.equal(rows[0]?.count, 5);
    assert.equal(rows[0]?.noisy_count, undefined);
  });
});

describe("legal pledge", () => {
  test("bumps version and states zero-text Global Brain plus Session Replay split", () => {
    assert.equal(CURRENT_LEGAL_VERSION, "2026.09.18-UTAH-SAFE");
    const joined = PLATFORM_PLEDGE.guarantees.join(" ");
    assert.match(joined, /never used to train/i);
    assert.match(joined, /zero-text|structural only/i);
    assert.match(joined, /synthetically generated/i);
    assert.match(joined, /msgf_prompt_sessions/);
    assert.match(PROMPT_SESSION_RETENTION_NOTICE, /not used to train/i);
    assert.match(PROMPT_SESSION_RETENTION_NOTICE, /not the Global Brain feed/i);
  });
});
