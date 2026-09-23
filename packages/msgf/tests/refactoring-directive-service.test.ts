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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * P3 — refactoring directive profile pack.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { buildRefactoringDirectivePack } from "../lib/services/refactoring-directive-service.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("refactoring-directive-service", () => {
  test("website_modernization includes deny list", () => {
    process.env.MSGF_REPO_ROOT = repoRoot;
    const pack = buildRefactoringDirectivePack("website_modernization");
    assert.match(pack.directive_markdown, /Refactoring Directive/i);
    assert.ok(pack.deny_list.some((d) => d.includes("app/api")));
    assert.ok(pack.validation_commands.length >= 1);
  });
});
