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
 * Distribution Build ID: MSGF-e98bd4c-20260522T053721Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  IngestRequestBodySchema,
  IngestValidationError,
  SweepPillarVectorMetadataSchema,
  parseIngestRequestBody,
  parseSweepPillarVectorMetadata,
} from "../lib/schemas/ingest-metadata";
import {
  GenealogicalBugIndexSchema,
  VaultHallMetadataSchema,
  buildGenealogicalBugIndex,
  buildVaultHallMetadata,
} from "../lib/schemas/vault-hall-metadata";
import {
  buildIngestMetadata,
  pathToGenealogicalBugIndex,
} from "../lib/services/IngestService";

describe("GenealogicalBugIndexSchema", () => {
  test("accepts coherent 1.0 / 1.1 / 1.1.1 slugs", () => {
    const index = buildGenealogicalBugIndex({
      level_1_category: "1.0_AUTH",
      level_1_1_branch: "1.1_LOGIN",
      level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
    });
    assert.equal(GenealogicalBugIndexSchema.safeParse(index).success, true);
  });

  test("rejects mismatched genealogical roots", () => {
    const bad = {
      level_1_category: "1.0_AUTH",
      level_1_1_branch: "2.1_OTHER",
      level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
    };
    assert.equal(GenealogicalBugIndexSchema.safeParse(bad).success, false);
  });

  test("rejects weak instance slug", () => {
    assert.equal(
      GenealogicalBugIndexSchema.safeParse({
        level_1_category: "1.0_AUTH",
        level_1_1_branch: "1.1_LOGIN",
        level_1_1_1_instance: "1.1",
      }).success,
      false
    );
  });
});

describe("VaultHallMetadataSchema", () => {
  test("rejects category/branch drift from bug_index", () => {
    const index = buildGenealogicalBugIndex({
      level_1_category: "1.0_PULSE",
      level_1_1_branch: "1.1_DEFEND",
      level_1_1_1_instance: "1.1.1_SHADOW_REJECT",
    });
    const raw = buildVaultHallMetadata({ ledger: "hall", bugIndex: index });
    const mutated = { ...raw, category: "2.0_WRONG" };
    assert.equal(VaultHallMetadataSchema.safeParse(mutated).success, false);
  });
});

describe("IngestRequestBodySchema", () => {
  test("rejects unknown top-level keys", () => {
    assert.throws(
      () => parseIngestRequestBody({ tenant_id: "t1", lineage_map: [] }),
      (e: unknown) => e instanceof IngestValidationError
    );
  });

  test("rejects per-file metadata blobs", () => {
    const parsed = IngestRequestBodySchema.safeParse({
      files: [
        {
          path: "lib/a.ts",
          content: "x",
          metadata: { ledger: "vault", bug_index: { level_1_category: "1.0_X" } },
        },
      ],
    });
    assert.equal(parsed.success, false);
  });

  test("rejects incoherent client bug_index", () => {
    assert.throws(
      () =>
        parseIngestRequestBody({
          files: [
            {
              path: "lib/a.ts",
              content: "export {}",
              bug_index: {
                level_1_category: "1.0_AUTH",
                level_1_1_branch: "3.1_BAD",
                level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
              },
            },
          ],
        }),
      (e: unknown) => e instanceof IngestValidationError
    );
  });

  test("accepts minimal valid payload", () => {
    const body = parseIngestRequestBody({
      tenant_id: "00000000-0000-4000-8000-000000000099",
      files: [{ path: "apps/x/a.ts", content: "const x = 1" }],
    });
    assert.equal(body.files?.length, 1);
  });
});

describe("SweepPillarVectorMetadataSchema", () => {
  test("buildIngestMetadata output passes strict sweep contract", () => {
    const bugIndex = pathToGenealogicalBugIndex("apps/demo/api/route.ts");
    const meta = buildIngestMetadata({
      tenantId: "00000000-0000-4000-8000-000000000099",
      projectOrigin: "apps/demo",
      filePath: "apps/demo/api/route.ts",
      bugIndex,
      governancePillar: "P2",
    });
    const parsed = parseSweepPillarVectorMetadata(meta);
    assert.equal(parsed.ingest_source, "sweep");
    assert.equal(parsed.ledger, "vault");
    assert.equal(parsed.bug_index.level_1_1_1_instance, "1.1.1_INGEST_BASELINE");
    assert.equal(parsed.category, parsed.bug_index.level_1_category);
    assert.equal(parsed.instance_slug, parsed.bug_index.level_1_1_1_instance);
  });
});
