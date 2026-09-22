import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  bestSimilarityMatch,
  memoryContentHash,
  MSGF_MEMORY_SIMILARITY_THRESHOLD,
  scoreMemoryMatch,
} from "../lib/gateway/memory-similarity.js";

describe("tenant memory similarity", () => {
  test("exact hash wins before similarity", () => {
    const score = scoreMemoryMatch({
      queryText: "same prompt",
      rowText: "same   prompt",
      queryEmbedding: [0, 1],
      rowEmbedding: [1, 0],
    });
    assert.equal(score, 1);
    assert.equal(memoryContentHash("same prompt"), memoryContentHash("same   prompt"));
  });

  test("0.92 hits and 0.91 misses", () => {
    assert.equal(MSGF_MEMORY_SIMILARITY_THRESHOLD, 0.92);
    const query = [1, 0];
    const hit = bestSimilarityMatch(
      query,
      [{ embedding: [0.95, Math.sqrt(1 - 0.95 * 0.95)], item: "near" }],
      0.92
    );
    assert.equal(hit?.item, "near");
    const miss = scoreMemoryMatch({
      queryText: "alpha",
      rowText: "beta",
      queryEmbedding: [1, 0],
      rowEmbedding: [0.91, Math.sqrt(1 - 0.91 * 0.91)],
    });
    assert.equal(miss, null);
  });
});
