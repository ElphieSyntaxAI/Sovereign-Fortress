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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MSGF_ACTIVE_FILE_HEADER,
  MSGF_BUILD_ACTIVE_HEADER,
  MSGF_DEV_SESSION_HEADER,
  MSGF_FLUSH_REASON_HEADER,
} from "../lib/msgf-http-headers.js";
import {
  parseDevSessionFromHeaders,
  resolveDevSessionEscalationThreshold,
} from "../lib/services/dev-session-profile.js";
import { assessLogicDrift } from "../lib/services/logic-drift.js";
import { DEFAULT_P2_ROADMAP } from "../lib/services/p2-flow-roadmap.js";
import type { ShadowPreflightResult } from "../lib/msgf-shadow.js";

const greenPreflight: ShadowPreflightResult = {
  tier: "GREEN",
  blocked: false,
  reason: "ok",
  vaultMatch: null,
  hallMatch: null,
};

describe("dev-session-profile", () => {
  test("parseDevSessionFromHeaders reads IDE headers", () => {
    const headers = new Headers({
      [MSGF_DEV_SESSION_HEADER]: "1",
      [MSGF_BUILD_ACTIVE_HEADER]: "1",
      [MSGF_FLUSH_REASON_HEADER]: "save",
      [MSGF_ACTIVE_FILE_HEADER]: encodeURIComponent("src/App.tsx"),
    });
    const h = parseDevSessionFromHeaders(headers);
    assert.equal(h.devSession, true);
    assert.equal(h.buildActive, true);
    assert.equal(h.flushReason, "save");
    assert.equal(h.activeFilePath, "src/App.tsx");
  });

  test("resolveDevSessionEscalationThreshold relaxes vs base", () => {
    const base = 0.3;
    const relaxed = resolveDevSessionEscalationThreshold(base, {
      devSession: true,
      buildActive: true,
      flushReason: null,
      activeFilePath: null,
    });
    assert.ok(relaxed > base);
  });

  test("build-active discount lowers drift score", () => {
    const vaultP2 = {
      roadmap: DEFAULT_P2_ROADMAP,
      aligned: [],
      neutral: [],
      contradicts: [],
      prioritized: [],
    };
    const without = assessLogicDrift({
      pulseText: "a ".repeat(200),
      halScore: 72,
      vaultP2Prioritized: vaultP2,
      preflight: greenPreflight,
      escalationThreshold: 0.3,
    });
    const withDiscount = assessLogicDrift({
      pulseText: "a ".repeat(200),
      halScore: 72,
      vaultP2Prioritized: vaultP2,
      preflight: greenPreflight,
      escalationThreshold: 0.42,
      driftScoreDiscount: 0.1,
    });
    assert.ok(withDiscount.score <= without.score);
  });
});
