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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildVaultCrossRefContext,
  DEFAULT_P2_ROADMAP,
  type PrioritizedVaultLineage,
  type VaultLineageRow,
} from "../lib/services/p2-flow-roadmap.js";

function row(id: string, content: string): VaultLineageRow {
  return { id, content, metadata: { file_path: content } };
}

describe("vault active-file shard", () => {
  test("matching file rows appear before others in cross-ref", () => {
    const aligned = [
      {
        row: row("1", "fix for packages/other/file.ts"),
        alignmentScore: 5,
        alignedWithRoadmap: true,
        contradictsRoadmap: false,
        matchedAlignment: ["msgf 1.0"],
        matchedDeprecated: [],
      },
      {
        row: row("2", "fix for src/components/App.tsx handler"),
        alignmentScore: 4,
        alignedWithRoadmap: true,
        contradictsRoadmap: false,
        matchedAlignment: ["msgf 1.0"],
        matchedDeprecated: [],
      },
    ];
    const prioritized: PrioritizedVaultLineage = {
      roadmap: DEFAULT_P2_ROADMAP,
      aligned,
      neutral: [],
      contradicts: [],
      prioritized: aligned.map((c) => c.row),
    };

    const ctx = buildVaultCrossRefContext(prioritized, {
      activeFilePath: "src/components/App.tsx",
    });
    const appPos = ctx.indexOf("App.tsx");
    const otherPos = ctx.indexOf("other/file.ts");
    assert.ok(appPos > 0 && otherPos > 0);
    assert.ok(appPos < otherPos);
  });
});
