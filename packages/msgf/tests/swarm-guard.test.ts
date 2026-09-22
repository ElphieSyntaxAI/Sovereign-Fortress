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
  MSGF_AGENT_ID_HEADER,
  MSGF_AGENT_ROLE_HEADER,
  MSGF_MANDATE_HASH_HEADER,
  MSGF_PARENT_AGENT_ID_HEADER,
} from "../lib/msgf-http-headers.ts";
import { auditEventMatchesQuery } from "../lib/services/emit-platform-audit.ts";
import {
  createMemorySwarmStore,
  detectSwarmCauses,
  emptySwarmGraph,
  evaluateSwarmAdmission,
  hashMandate,
  parseAgentIdentityFromHeaders,
  resetMemorySwarmStore,
  type SwarmAgentIdentity,
} from "../lib/services/swarm-guard.ts";
import { primaryFixForCauses } from "../lib/services/swarm-fix-catalog.ts";

const store = createMemorySwarmStore();

afterEach(() => {
  resetMemorySwarmStore();
  delete process.env.MSGF_SWARM_MAX_INFLIGHT;
  delete process.env.MSGF_SWARM_ENTITY_MAX;
});

function identity(partial: Partial<SwarmAgentIdentity> & Pick<SwarmAgentIdentity, "agentId" | "role">): SwarmAgentIdentity {
  return {
    parentAgentId: null,
    mandateHash: null,
    entityId: partial.entityId ?? partial.agentId,
    tenantId: "t1",
    ...partial,
  };
}

describe("parseAgentIdentityFromHeaders", () => {
  test("missing headers default to primary", () => {
    const h = new Headers();
    const id = parseAgentIdentityFromHeaders({
      headers: h,
      tenantId: "t1",
      entityId: "e1",
    });
    assert.equal(id.role, "primary");
    assert.equal(id.agentId, "e1");
    assert.equal(id.parentAgentId, null);
  });

  test("parent header infers secondary", () => {
    const h = new Headers({
      [MSGF_PARENT_AGENT_ID_HEADER]: "parent-1",
      [MSGF_AGENT_ID_HEADER]: "child-1",
      [MSGF_AGENT_ROLE_HEADER]: "",
    });
    const id = parseAgentIdentityFromHeaders({
      headers: h,
      tenantId: "t1",
      entityId: "e1",
    });
    assert.equal(id.role, "secondary");
    assert.equal(id.parentAgentId, "parent-1");
    assert.equal(id.agentId, "child-1");
  });

  test("primary auto-binds mandate from pulse seed", () => {
    const h = new Headers();
    const id = parseAgentIdentityFromHeaders({
      headers: h,
      tenantId: "t1",
      entityId: "e1",
      mandateSeed: "fix the login button",
    });
    assert.equal(id.mandateHash, hashMandate("fix the login button"));
  });
});

describe("evaluateSwarmAdmission", () => {
  test("primary missing headers is allowed", async () => {
    const result = await evaluateSwarmAdmission({
      store,
      identity: identity({ agentId: "primary-1", role: "primary" }),
    });
    assert.equal(result.ok, true);
  });

  test("secondary without mandate is killed", async () => {
    const result = await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "c1",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: null,
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.cause_codes.includes("mandate_missing"));
      assert.equal(result.suggested_fix.id, "narrow_mandate");
    }
  });

  test("mandate mismatch kills secondary", async () => {
    const mandate = hashMandate("parent task");
    await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "p1",
        role: "primary",
        mandateHash: mandate,
      }),
    });
    const result = await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "c1",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: hashMandate("other task"),
        entityId: "e-child",
      }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.cause_codes.includes("mandate_mismatch"));
  });

  test("matching mandate allows a secondary", async () => {
    const mandate = hashMandate("parent task");
    await evaluateSwarmAdmission({
      store,
      identity: identity({ agentId: "p1", role: "primary", mandateHash: mandate }),
    });
    const result = await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "c1",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: mandate,
        entityId: "e-child",
      }),
    });
    assert.equal(result.ok, true);
  });

  test("fan-out over 6 unique children trips", async () => {
    process.env.MSGF_SWARM_MAX_INFLIGHT = "20";
    process.env.MSGF_SWARM_ENTITY_MAX = "20";
    const mandate = hashMandate("parent task");
    await evaluateSwarmAdmission({
      store,
      identity: identity({ agentId: "p1", role: "primary", mandateHash: mandate }),
    });
    for (let i = 0; i < 6; i++) {
      const ok = await evaluateSwarmAdmission({
        store,
        identity: identity({
          agentId: `c${i}`,
          role: "secondary",
          parentAgentId: "p1",
          mandateHash: mandate,
          entityId: `e${i}`,
        }),
      });
      assert.equal(ok.ok, true, `child ${i} should pass`);
    }
    const seventh = await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "c6",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: mandate,
        entityId: "e6",
      }),
    });
    assert.equal(seventh.ok, false);
    if (!seventh.ok) assert.ok(seventh.cause_codes.includes("fanout_exceeded"));
  });

  test("child-to-child peer edge trips graph_anomaly", async () => {
    const mandate = hashMandate("parent task");
    await evaluateSwarmAdmission({
      store,
      identity: identity({ agentId: "p1", role: "primary", mandateHash: mandate }),
    });
    await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "c1",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: mandate,
        entityId: "e1",
      }),
    });
    const peer = await evaluateSwarmAdmission({
      store,
      identity: identity({
        agentId: "c2",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: mandate,
        entityId: "e2",
      }),
      peerAgentId: "c1",
    });
    assert.equal(peer.ok, false);
    if (!peer.ok) assert.ok(peer.cause_codes.includes("graph_anomaly"));
  });

  test("secondary fail-closed when store unavailable", () => {
    const causes = detectSwarmCauses({
      identity: identity({
        agentId: "c1",
        role: "secondary",
        parentAgentId: "p1",
        mandateHash: hashMandate("x"),
      }),
      graph: emptySwarmGraph(),
      redisAvailable: false,
    });
    assert.deepEqual(causes, ["redis_unavailable"]);
  });

  test("reputationPrune trips child without demoting parent role", async () => {
    const parent = identity({
      agentId: "p-rep",
      role: "primary",
      mandateHash: hashMandate("rep-mandate"),
    });
    const parentOk = await evaluateSwarmAdmission({ identity: parent, store });
    assert.equal(parentOk.ok, true);
    const child = await evaluateSwarmAdmission({
      identity: identity({
        agentId: "c-rep",
        role: "secondary",
        parentAgentId: "p-rep",
        mandateHash: hashMandate("rep-mandate"),
      }),
      store,
      reputationPrune: true,
    });
    assert.equal(child.ok, false);
    if (!child.ok) {
      assert.ok(child.cause_codes.includes("reputation_prune"));
    }
  });
});

describe("auditEventMatchesQuery", () => {
  test("q=swarm matches bot_swarm_detected kind and cause metadata", () => {
    const row = {
      kind: "bot_swarm_detected",
      summary: "bot_swarm_detected: fanout_exceeded",
      trace_id: "tr-1",
      metadata: {
        cause_codes: ["fanout_exceeded"],
        suggested_fix_id: "cap_inflight",
      },
    };
    assert.equal(auditEventMatchesQuery(row, "swarm"), true);
    assert.equal(auditEventMatchesQuery(row, "fanout_exceeded"), true);
    assert.equal(auditEventMatchesQuery(row, "cap_inflight"), true);
    assert.equal(auditEventMatchesQuery(row, "unrelated"), false);
  });
});

describe("suggestFixesForCauses", () => {
  test("mandate causes map to narrow_mandate", () => {
    assert.equal(primaryFixForCauses(["mandate_mismatch"]).id, "narrow_mandate");
  });
});

describe("parse headers mandate", () => {
  test("normalizes hex mandate header", () => {
    const hex = hashMandate("abc");
    const h = new Headers({ [MSGF_MANDATE_HASH_HEADER]: hex.toUpperCase() });
    const id = parseAgentIdentityFromHeaders({
      headers: h,
      tenantId: "t1",
      entityId: "e1",
    });
    assert.equal(id.mandateHash, hex);
  });
});
