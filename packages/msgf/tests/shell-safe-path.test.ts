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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Shell-safe path and verify-command guards.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertAllowedVerifyCommand,
  isSafeRepoRelativePath,
  redactTerminalSnippet,
} from "../lib/utils/shell-safe-path.js";

describe("shell-safe-path", () => {
  test("isSafeRepoRelativePath rejects traversal and metacharacters", () => {
    assert.equal(isSafeRepoRelativePath("app/models/user.rb"), true);
    assert.equal(isSafeRepoRelativePath("../etc/passwd"), false);
    assert.equal(isSafeRepoRelativePath("test; rm -rf /"), false);
    assert.equal(isSafeRepoRelativePath("/abs/path.rb"), false);
  });

  test("assertAllowedVerifyCommand allowlists npm and rails verify commands", () => {
    assert.equal(assertAllowedVerifyCommand("npm test"), "npm test");
    assert.equal(
      assertAllowedVerifyCommand("bundle exec rails test test/foo_test.rb"),
      "bundle exec rails test test/foo_test.rb"
    );
    assert.throws(() => assertAllowedVerifyCommand("npm test; curl evil"), /metacharacters/);
    assert.throws(() => assertAllowedVerifyCommand("curl http://evil"), /not allowlisted/);
  });

  test("redactTerminalSnippet strips secrets", () => {
    const out = redactTerminalSnippet("api_key=secret123 msgf_ide_abc.def");
    assert.match(out, /\[REDACTED\]/);
    assert.match(out, /\[REDACTED_IDE_TOKEN\]/);
    assert.doesNotMatch(out, /secret123/);
  });
});
