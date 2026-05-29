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
  appendPackSignature,
  PILLAR_6_CONSTRAINTS_BLOCK,
  sanitizeActiveFilePaths,
} from "../lib/services/prompt-optimizer-service.js";

describe("prompt-optimizer-service", () => {
  test("appendPackSignature injects hidden MSGF-PACK footer", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const md = appendPackSignature("# Hello\n", id);
    assert.ok(md.includes(`<!-- MSGF-PACK:${id} -->`));
    assert.ok(md.endsWith("\n"));
  });

  test("Pillar 6 constraints mention env and verify", () => {
    assert.ok(PILLAR_6_CONSTRAINTS_BLOCK.includes(".env"));
    assert.ok(PILLAR_6_CONSTRAINTS_BLOCK.includes("npm run build"));
  });

  test("sanitizeActiveFilePaths drops absolute and junk paths", () => {
    const clean = sanitizeActiveFilePaths([
      "app/controllers/teams_controller.rb",
      "c:/Users/jessi/OneDrive/Desktop/ElphieSyntaxLLC/without",
      "tunnelHostService",
      "test/controllers/teams_controller_test.rb",
    ]);
    assert.deepEqual(clean, [
      "app/controllers/teams_controller.rb",
      "test/controllers/teams_controller_test.rb",
    ]);
  });
});

describe("feature-verify-scripts", () => {
  test("buildFeatureVerifyScripts emits Rails test for scoped Ruby paths", async () => {
    const { buildFeatureVerifyScripts } = await import("../lib/services/feature-verify-scripts.js");
    const scripts = buildFeatureVerifyScripts(
      "add team membership controller tests",
      ["test/controllers/teams_controller_test.rb"],
      "11111111-1111-4111-8111-111111111111"
    );
    assert.ok(scripts.some((s) => s.command.includes("teams_controller_test.rb")));
    assert.ok(scripts.some((s) => s.command.includes("rails test")));
  });

  test("formatAgentInstructionsSection requires tests and exact verify command", async () => {
    const { buildFeatureVerifyScripts, formatAgentInstructionsSection } = await import(
      "../lib/services/feature-verify-scripts.js"
    );
    const scripts = buildFeatureVerifyScripts(
      "add team membership controller tests",
      ["test/controllers/teams_controller_test.rb", "app/controllers/teams_controller.rb"],
      "11111111-1111-4111-8111-111111111111"
    );
    const block = formatAgentInstructionsSection({
      userIntent: "add team membership controller tests",
      paths: ["test/controllers/teams_controller_test.rb", "app/controllers/teams_controller.rb"],
      verifyScripts: scripts,
      verifyHint: "`bin/rails test`",
    }).join("\n");
    assert.ok(block.includes("MANDATORY AGENT EXECUTION RULES"));
    assert.ok(block.includes("SMART TEST COVERAGE"));
    assert.ok(block.includes("teams_controller_test.rb"));
    assert.ok(block.includes("EXTEND"));
    assert.ok(block.includes(scripts[0]!.command));
    assert.ok(block.includes("| File | Change | Test spec executed | Pass/Fail |"));
  });
});

describe("sweep-ingest-index", () => {
  test("buildComposerAttachments emits @file and @folder lines", async () => {
    const { buildComposerAttachments } = await import("../lib/services/sweep-ingest-index.js");
    const block = buildComposerAttachments([
      "test/controllers/teams_controller_test.rb",
      "app/controllers/teams_controller.rb",
    ]);
    assert.ok(block.file_lines.includes("@test/controllers/teams_controller_test.rb"));
    assert.ok(block.folder_lines.some((l) => l.startsWith("@folder/")));
  });
});
