import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendDevSessionPulseHeaders,
  isSavePrimaryPulseMode,
} from "../src/devSessionPulse.ts";

const devSettings = {
  tenantKey: "deck_host",
  authToken: "test-token",
  apiUrl: "https://example.com",
  devSession: true,
  role: "dev",
  organizationId: "",
  licenseKey: "",
  entityId: "machine-1",
  smallBrainProvider: "gemini" as const,
  smallBrainApiKey: "",
  smallBrainModelName: "",
};

describe("dev-session-pulse", () => {
  it("isSavePrimaryPulseMode follows msgf.devSession", () => {
    assert.equal(isSavePrimaryPulseMode({ devSession: true }), true);
    assert.equal(isSavePrimaryPulseMode({ devSession: false }), false);
  });

  it("appendDevSessionPulseHeaders adds save flush markers", () => {
    const headers: Record<string, string> = {};
    appendDevSessionPulseHeaders(headers, devSettings, {
      devSession: true,
      flushReason: "save",
      activeFilePath: "src/app.ts",
      buildActive: false,
    });

    assert.equal(headers["x-msgf-dev-session"], "1");
    assert.equal(headers["x-msgf-flush-reason"], "save");
    assert.equal(headers["x-msgf-active-file"], encodeURIComponent("src/app.ts"));
    assert.equal(headers["x-msgf-build-active"], undefined);
  });

  it("appendDevSessionPulseHeaders sets build-active when task running", () => {
    const headers: Record<string, string> = {};
    appendDevSessionPulseHeaders(headers, devSettings, {
      devSession: true,
      flushReason: "build_end",
      buildActive: true,
    });
    assert.equal(headers["x-msgf-build-active"], "1");
    assert.equal(headers["x-msgf-flush-reason"], "build_end");
  });

});
