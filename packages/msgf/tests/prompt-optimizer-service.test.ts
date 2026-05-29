import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  appendPackSignature,
  PILLAR_6_CONSTRAINTS_BLOCK,
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
});
