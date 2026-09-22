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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { withMsgfMetadataScope } from "../lib/services/msgf-metadata-scope.ts";
import {
  filterPillarRowsByCompoundScope,
  pillarRowMatchesCompoundScope,
} from "../lib/services/tenant-query-scope.ts";
import {
  computeSubpathHash,
  normalizePathForScope,
} from "../lib/services/vector-scope-key.ts";

describe("vector-scope-key", () => {
  test("normalizePathForScope collapses separators and lowercases", () => {
    assert.equal(normalizePathForScope("  .\\Foo\\Bar\\ "), "foo/bar");
    assert.equal(normalizePathForScope("a//b/c/"), "a/b/c");
  });

  test("computeSubpathHash is stable 16 hex", () => {
    const a = computeSubpathHash("packages/msgf/lib/services/foo.ts");
    const b = computeSubpathHash("packages\\msgf\\lib\\services\\foo.ts");
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{16}$/);
  });
});

describe("compound scope filter", () => {
  const companyA = "11111111-1111-4111-8111-111111111111";
  const companyB = "22222222-2222-4222-8222-222222222222";
  const hashFoo = computeSubpathHash("src/foo.ts");

  const rows = [
    {
      id: "1",
      metadata: {
        tenant_id: "starmap",
        company_id: companyA,
        project_origin: "starmap",
        subpath_hash: hashFoo,
      },
    },
    {
      id: "2",
      metadata: {
        tenant_id: "starmap",
        company_id: companyB,
        project_origin: "starport",
        subpath_hash: hashFoo,
      },
    },
    {
      id: "3",
      metadata: {
        tenant_id: "starmap",
        project_origin: "starmap",
        subpath_hash: computeSubpathHash("src/other.ts"),
      },
    },
  ];

  test("wrong project_origin returns empty", () => {
    const kept = filterPillarRowsByCompoundScope(rows, {
      tenantId: "starmap",
      projectOrigin: "devlish",
    });
    assert.equal(kept.length, 0);
  });

  test("company mismatch excluded when row has company_id; legacy null company kept", () => {
    const kept = filterPillarRowsByCompoundScope(rows, {
      tenantId: "starmap",
      companyId: companyA,
      projectOrigin: "starmap",
    });
    assert.deepEqual(
      kept.map((r) => r.id),
      ["1", "3"]
    );
  });

  test("subpath_hash isolates path", () => {
    const kept = filterPillarRowsByCompoundScope(rows, {
      tenantId: "starmap",
      projectOrigin: "starmap",
      filePath: "src/foo.ts",
    });
    assert.deepEqual(
      kept.map((r) => r.id),
      ["1"]
    );
  });

  test("withMsgfMetadataScope stamps subpath_hash", () => {
    const meta = withMsgfMetadataScope(
      { ledger: "vault" },
      {
        tenantId: "starmap",
        projectOrigin: "starmap",
        filePath: "src/foo.ts",
        companyId: companyA,
      }
    );
    assert.equal(meta.subpath_hash, hashFoo);
    assert.equal(meta.project_origin, "starmap");
    assert.equal(meta.company_id, companyA);
    assert.ok(
      pillarRowMatchesCompoundScope(meta, {
        tenantId: "starmap",
        projectOrigin: "starmap",
        filePath: "src/foo.ts",
        companyId: companyA,
      })
    );
  });
});
