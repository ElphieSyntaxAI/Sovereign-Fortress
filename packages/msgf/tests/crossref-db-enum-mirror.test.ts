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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Zod ↔ Postgres CROSS-REF contract mirror tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MSG_DB_BUG_INDEX_LEVEL_1_REGEX,
  MSG_DB_BUG_INDEX_LEVEL_11_REGEX,
  MSG_DB_BUG_INDEX_LEVEL_111_REGEX,
  MSG_DB_CONSTRAINT_LEDGERS,
  MSG_DB_GOVERNANCE_PILLARS,
  MSG_DB_SCHEDULING_TIERS,
  GenealogicalBugIndexSchema,
  MsgfGovernancePillarSchema,
  PillarVectorCrossRefColumnsSchema,
  pillarVectorCrossRefColumnsFromMetadata,
  buildGenealogicalBugIndex,
  buildVaultHallMetadata,
} from "../lib/schemas/vault-hall-metadata";

describe("Postgres ENUM mirror (Zod)", () => {
  test("governance pillars match MSG_DB_GOVERNANCE_PILLARS", () => {
    assert.deepEqual(MsgfGovernancePillarSchema.options, [...MSG_DB_GOVERNANCE_PILLARS]);
  });

  test("scheduling tiers are RED | YELLOW | GREEN", () => {
    assert.deepEqual(MSG_DB_SCHEDULING_TIERS, ["RED", "YELLOW", "GREEN"]);
  });

  test("constraint ledgers are vault | hall", () => {
    assert.deepEqual(MSG_DB_CONSTRAINT_LEDGERS, ["vault", "hall"]);
  });
});

describe("Genealogical regex mirror (DOMAIN)", () => {
  test("coherent index passes all three patterns", () => {
    const index = buildGenealogicalBugIndex({
      level_1_category: "1.0_PULSE",
      level_1_1_branch: "1.1_DEFEND",
      level_1_1_1_instance: "1.1.1_SHADOW_REJECT",
    });
    assert.match(index.level_1_category, MSG_DB_BUG_INDEX_LEVEL_1_REGEX);
    assert.match(index.level_1_1_branch, MSG_DB_BUG_INDEX_LEVEL_11_REGEX);
    assert.match(index.level_1_1_1_instance, MSG_DB_BUG_INDEX_LEVEL_111_REGEX);
    assert.equal(GenealogicalBugIndexSchema.safeParse(index).success, true);
  });

  test("branch root mismatch fails Zod before DB", () => {
    const bad = {
      level_1_category: "1.0_AUTH",
      level_1_1_branch: "2.1_OTHER",
      level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
    };
    assert.equal(GenealogicalBugIndexSchema.safeParse(bad).success, false);
  });
});

describe("pillarVectorCrossRefColumnsFromMetadata", () => {
  test("emits typed columns for Vault row", () => {
    const bugIndex = buildGenealogicalBugIndex({
      level_1_category: "1.0_PULSE",
      level_1_1_branch: "1.1_CONVERGE",
      level_1_1_1_instance: "1.1.1_CONSENSUS_VAULT",
    });
    const meta = buildVaultHallMetadata({
      ledger: "vault",
      bugIndex,
      tenantId: "00000000-0000-4000-8000-000000000099",
    });
    const cols = pillarVectorCrossRefColumnsFromMetadata(meta);
    const parsed = PillarVectorCrossRefColumnsSchema.safeParse(cols);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.constraint_ledger, "vault");
      assert.equal(parsed.data.governance_pillar, "P6");
      assert.equal(parsed.data.genealogical_root, 1);
    }
  });
});
