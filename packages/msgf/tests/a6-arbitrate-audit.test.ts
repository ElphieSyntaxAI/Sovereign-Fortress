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
import { describe, test } from "node:test";

import {
  ARBITRATE_AUDIT_GENESIS_HASH,
  arbitrateAuditSecret,
  canonicalizeArbitrateAuditPayload,
  computeArbitrateRowHash,
  signArbitrateAuditPayload,
  sortKeysDeep,
  verifyArbitrateAuditRow,
  verifyArbitrateAuditSignature,
  type ArbitrateAuditPayload,
} from "../lib/services/arbitrate-audit.ts";

function samplePayload(overrides?: Partial<ArbitrateAuditPayload>): ArbitrateAuditPayload {
  return {
    schema_version: 1,
    source: "admin_incident_resolve",
    project_origin: "elphiesyntax/msgf",
    operator_id: "op-1",
    action: "RESOLVED",
    incident_id: "11111111-1111-1111-1111-111111111111",
    file_path: "src/foo.ts",
    tenant_id: "tenant-1",
    entity_id: "entity-1",
    bug_index: { level_1_1_1_instance: "1.1.1_HITL_TIEBREAKER" },
    model_opinions: { A: "approve", B: "deny" },
    inputs: { note: "ok" },
    resolution: { ledger: "vault" },
    ts: "2026-07-24T01:00:00.000Z",
    ...overrides,
  };
}

describe("arbitrate-audit HMAC + hash chain", () => {
  test("sortKeysDeep is stable", () => {
    const a = sortKeysDeep({ b: 1, a: { z: 2, y: 1 } });
    const b = sortKeysDeep({ a: { y: 1, z: 2 }, b: 1 });
    assert.deepEqual(a, b);
  });

  test("sign then verify; tamper fails", () => {
    const secret = "arbitrate-test-key";
    const payload = samplePayload();
    const sig = signArbitrateAuditPayload(payload, secret);
    assert.equal(sig.length, 64);
    assert.equal(verifyArbitrateAuditSignature(payload, sig, secret), true);
    assert.equal(
      verifyArbitrateAuditSignature({ ...payload, action: "TAMPER" }, sig, secret),
      false
    );
  });

  test("row hash chains from prev_hash", () => {
    const secret = "arbitrate-test-key";
    const payload = samplePayload();
    const canonical = canonicalizeArbitrateAuditPayload(payload);
    const sig = signArbitrateAuditPayload(payload, secret);
    const rowHash = computeArbitrateRowHash(
      canonical,
      sig,
      ARBITRATE_AUDIT_GENESIS_HASH
    );
    assert.equal(rowHash.length, 64);

    const ok = verifyArbitrateAuditRow(
      {
        payload_json: payload,
        signature: sig,
        prev_hash: ARBITRATE_AUDIT_GENESIS_HASH,
        row_hash: rowHash,
      },
      secret
    );
    assert.equal(ok.ok, true);

    const bad = verifyArbitrateAuditRow(
      {
        payload_json: { ...payload, action: "TAMPER" },
        signature: sig,
        prev_hash: ARBITRATE_AUDIT_GENESIS_HASH,
        row_hash: rowHash,
      },
      secret
    );
    assert.equal(bad.ok, false);
    assert.equal(bad.signature_ok, false);
  });

  test("arbitrateAuditSecret prefers MSGF_ARBITRATE_AUDIT_KEY", () => {
    assert.equal(
      arbitrateAuditSecret({
        MSGF_ARBITRATE_AUDIT_KEY: "a",
        MSGF_OPS_CRON_SECRET: "b",
      } as NodeJS.ProcessEnv),
      "a"
    );
    assert.equal(
      arbitrateAuditSecret({ MSGF_OPS_CRON_SECRET: "b" } as NodeJS.ProcessEnv),
      "b"
    );
    assert.equal(arbitrateAuditSecret({} as NodeJS.ProcessEnv), null);
  });
});
