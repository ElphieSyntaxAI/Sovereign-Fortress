import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isBulkRagShard,
  isProtectedCuratedEntry,
  isRagExcluded,
} from "../src/lib/narrative/narrativeChunkVisibility.js";

describe("narrativeChunkVisibility", () => {
  test("isRagExcluded detects rag_excluded_at, chunk_feedback, wiki_scrapped_at", () => {
    assert.equal(isRagExcluded({}), false);
    assert.equal(isRagExcluded({ rag_excluded_at: "2026-01-01T00:00:00.000Z" }), true);
    assert.equal(
      isRagExcluded({ chunk_feedback: { reported: true, reason: "merged_topics" } }),
      true
    );
    assert.equal(isRagExcluded({ wiki_scrapped_at: "2026-01-01T00:00:00.000Z" }), true);
  });

  test("isProtectedCuratedEntry guards wiki_author_entry and lore_extraction entities", () => {
    assert.equal(isProtectedCuratedEntry({ wiki_author_entry: true }), true);
    assert.equal(
      isProtectedCuratedEntry({ lore_extraction: true, proposed_chunk_title: "Elphine" }),
      true
    );
    assert.equal(isProtectedCuratedEntry({ rag_index: true }), false);
  });

  test("isBulkRagShard identifies bulk shards but not curated wiki rows", () => {
    assert.equal(isBulkRagShard({ rag_index: true }), true);
    assert.equal(isBulkRagShard({ file_import: true }), true);
    assert.equal(isBulkRagShard({ wiki_author_entry: true, rag_index: true }), false);
  });
});
