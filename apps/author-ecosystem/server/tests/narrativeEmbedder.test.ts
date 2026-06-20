import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

describe("narrativeEmbedderProvider", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  test("prefers openai when OPENAI_API_KEY is set", async () => {
    process.env = { ...env, OPENAI_API_KEY: "sk-test", GCP_API_KEY: "gcp-test" };
    const { narrativeEmbedderProvider } = await import("../src/lib/narrative/narrativeEmbedder.js");
    assert.equal(narrativeEmbedderProvider(), "openai");
  });

  test("uses gemini when only GCP_API_KEY is set", async () => {
    process.env = { ...env, OPENAI_API_KEY: "", GCP_API_KEY: "gcp-test" };
    delete process.env.OPENAI_API_KEY;
    const { narrativeEmbedderProvider } = await import("../src/lib/narrative/narrativeEmbedder.js");
    assert.equal(narrativeEmbedderProvider(), "gemini");
  });

  test("returns none when no embed keys configured", async () => {
    process.env = { ...env };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GCP_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const { narrativeEmbedderProvider } = await import("../src/lib/narrative/narrativeEmbedder.js");
    assert.equal(narrativeEmbedderProvider(), "none");
  });
});
