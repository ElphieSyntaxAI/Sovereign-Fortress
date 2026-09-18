import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appendSwarmPulseHeaders } from "../src/swarmPulseHeaders.ts";

describe("swarm pulse headers", () => {
  it("does not force role when settings are empty (server treats as primary)", () => {
    const headers: Record<string, string> = {};
    appendSwarmPulseHeaders(
      headers,
      { agentId: "", parentAgentId: "", agentRole: "", mandateHash: "" },
      "machine-1"
    );
    assert.equal(headers["x-msgf-agent-id"], "machine-1");
    assert.equal(headers["x-msgf-agent-role"], undefined);
    assert.equal(headers["x-msgf-parent-agent-id"], undefined);
  });

  it("forwards parent, secondary role, and mandate hash", () => {
    const headers: Record<string, string> = {};
    appendSwarmPulseHeaders(
      headers,
      {
        agentId: "child-9",
        parentAgentId: "parent-1",
        agentRole: "secondary",
        mandateHash: "aa".repeat(32),
      },
      "machine-1"
    );
    assert.equal(headers["x-msgf-agent-id"], "child-9");
    assert.equal(headers["x-msgf-parent-agent-id"], "parent-1");
    assert.equal(headers["x-msgf-agent-role"], "secondary");
    assert.equal(headers["x-msgf-mandate-hash"], "aa".repeat(32));
  });
});
