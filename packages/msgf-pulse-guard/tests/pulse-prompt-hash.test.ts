import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { MSGF_PROMPT_HASH_HEADER } from "../src/constants.ts";
import { hashPulsePayload } from "../src/pulsePromptHash.ts";

describe("pulse prompt hash", () => {
  it("hashes the keystroke payload and does not add a body field", () => {
    const keystrokes = [{ t: 1, key: "a" }];
    const hash = hashPulsePayload(keystrokes);
    assert.equal(
      hash,
      createHash("sha256").update(JSON.stringify(keystrokes), "utf8").digest("hex")
    );
    assert.equal(hash.length, 64);
    assert.equal(MSGF_PROMPT_HASH_HEADER, "x-msgf-prompt-hash");
    const body = { keystrokes };
    assert.equal("prompt" in body, false);
    assert.equal("prompt_text" in body, false);
  });
});
