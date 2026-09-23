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
import { describe, test } from "node:test";

import { DevEventBodySchema } from "../lib/schemas/dev-event.js";
import {
  buildFailureBugIndex,
  excerptTokens,
  scoreVaultRow,
} from "../lib/services/dev-event-build-heal.js";
import type { VaultLineageRow } from "../lib/services/p2-flow-roadmap.js";

describe("dev-event", () => {
  test("DevEventBodySchema accepts build_failed payload", () => {
    const parsed = DevEventBodySchema.parse({
      kind: "build_failed",
      activeFile: "src/App.tsx",
      excerpt: "error TS2322: Type string is not assignable",
      exitCode: 1,
      tenantId: "my-repo",
    });
    assert.equal(parsed.kind, "build_failed");
  });

  test("buildFailureBugIndex maps file to 1.1.1_IDE_BUILD_FAILED", () => {
    const idx = buildFailureBugIndex("packages/msgf/lib/foo.ts");
    assert.equal(idx.level_1_1_1_instance, "1.1.1_IDE_BUILD_FAILED");
    assert.ok(idx.level_1_category.startsWith("1.0_"));
  });

  test("vault row scores higher when excerpt tokens match content", () => {
    const row: VaultLineageRow = {
      id: "1",
      content: "Fix TS2322 by narrowing props in App.tsx",
      metadata: { file_path: "src/App.tsx" },
    };
    const tokens = excerptTokens("error TS2322 in App.tsx");
    const score = scoreVaultRow(row, "src/app.tsx", tokens);
    assert.ok(score >= 0.22);
  });
});
