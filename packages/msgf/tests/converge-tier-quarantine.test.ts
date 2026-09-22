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
  pathsOverlap,
  pickVaultIdsForTierQuarantine,
  quarantineVaultFromTierDisagreement,
} from "../lib/services/converge-tier/tier-quarantine.ts";
import { routeCodeDelta } from "../lib/services/converge-tier/router.ts";
import type { TierConvergeProvider } from "../lib/services/converge-tier/converge-runner.ts";

describe("tier-quarantine helpers", () => {
  test("pathsOverlap matches basename and suffix", () => {
    assert.equal(pathsOverlap("src/auth/login.ts", ["auth/login.ts"]), true);
    assert.equal(pathsOverlap("packages/app/src/Card.tsx", ["Card.tsx"]), true);
    assert.equal(pathsOverlap("src/a.ts", ["src/b.ts"]), false);
  });

  test("pickVaultIdsForTierQuarantine prefers explicit ids", () => {
    const ids = pickVaultIdsForTierQuarantine(
      [{ id: "a", quarantine_status: "NONE" }],
      { vectorIds: ["v1", "v2"], paths: ["src/x.ts"] }
    );
    assert.deepEqual(ids, ["v1", "v2"]);
  });

  test("pickVaultIdsForTierQuarantine filters by path overlap", () => {
    const ids = pickVaultIdsForTierQuarantine(
      [
        {
          id: "keep",
          quarantine_status: "NONE",
          metadata: { file_path: "src/auth/login.ts" },
        },
        {
          id: "skip",
          quarantine_status: "NONE",
          metadata: { file_path: "docs/readme.md" },
        },
        {
          id: "blocked",
          quarantine_status: "QUARANTINED",
          metadata: { file_path: "src/auth/login.ts" },
        },
      ],
      { paths: ["src/auth/login.ts"] }
    );
    assert.deepEqual(ids, ["keep"]);
  });
});

describe("quarantineVaultFromTierDisagreement", () => {
  test("no-op when not TIER_3", async () => {
    const r = await quarantineVaultFromTierDisagreement({} as never, {
      tenantId: "t1",
      finalTier: "TIER_2",
      vectorIds: ["v1"],
    });
    assert.equal(r.quarantined, false);
    assert.equal(r.reason, "not_tier_3");
  });

  test("updates matching vectors to QUARANTINED", async () => {
    const updates: Array<{ ids: string[]; patch: Record<string, unknown> }> = [];
    const admin = {
      from() {
        return {
          update(patch: Record<string, unknown>) {
            return {
              in(_col: string, ids: string[]) {
                updates.push({ ids, patch });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const r = await quarantineVaultFromTierDisagreement(admin as never, {
      tenantId: "t1",
      finalTier: "TIER_3",
      vectorIds: ["vec-a", "vec-b"],
      pulseTraceId: "trace-1",
    });

    assert.equal(r.quarantined, true);
    assert.deepEqual(r.vectorIds, ["vec-a", "vec-b"]);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].patch.quarantine_status, "QUARANTINED");
    assert.ok(String(updates[0].patch.quarantine_reason).includes("T3"));
  });
});

describe("routeCodeDelta T3 quarantine wiring", () => {
  test("quarantineRecommended triggers vault quarantine when admin present", async () => {
    process.env.MSGF_CONVERGE_TIER_ENABLED = "1";
    let calls = 0;
    const provider: TierConvergeProvider = {
      callModel: async () => {
        calls += 1;
        return calls % 2 === 1 ? "alpha side" : "beta side totally different";
      },
    };

    const updates: string[][] = [];
    const admin = {
      from(table: string) {
        if (table === "msgf_company_tier_rules") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return Promise.resolve({ data: [], error: null });
                    },
                  };
                },
              };
            },
          };
        }
        return {
          update() {
            return {
              in(_col: string, ids: string[]) {
                updates.push(ids);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };

    const routed = await routeCodeDelta({
      payload: {
        paths: ["src/auth/login.ts"],
        linesAdded: 2,
        companyId: null,
      },
      admin: admin as never,
      forcedTier: "TIER_1",
      convergePrompt: "review this auth change",
      tenantId: "tenant-q",
      provider,
      vaultVectorIds: ["vault-1"],
      pulseTraceId: "tr-q",
    });

    assert.equal(routed.converge?.ok, false);
    if (routed.converge && !routed.converge.ok) {
      assert.equal(routed.converge.quarantineRecommended, true);
    }
    assert.equal(routed.quarantine?.quarantined, true);
    assert.deepEqual(routed.quarantine?.vectorIds, ["vault-1"]);
    assert.ok(updates.some((ids) => ids.includes("vault-1")));

    delete process.env.MSGF_CONVERGE_TIER_ENABLED;
  });
});
