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
