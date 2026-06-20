import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  allocateChunkIndices,
  isChunkActive,
  isUserOverrideChunk,
  markUserOverride,
} from "../src/lib/chunkLifecycle.js";
import {
  convergeUpsertWikiEntry,
  entityFingerprint,
} from "../src/lib/ingestConverge.js";

describe("chunkLifecycle", () => {
  test("isUserOverrideChunk detects author lock", () => {
    assert.equal(isUserOverrideChunk({}), false);
    assert.equal(isUserOverrideChunk({ user_override: true }), true);
  });

  test("isChunkActive respects is_deleted and wiki_scrapped_at", () => {
    assert.equal(isChunkActive({ is_deleted: false, metadata: {} }), true);
    assert.equal(isChunkActive({ is_deleted: true, metadata: {} }), false);
    assert.equal(
      isChunkActive({ is_deleted: false, metadata: { wiki_scrapped_at: "2026-01-01T00:00:00.000Z" } }),
      false
    );
  });

  test("allocateChunkIndices skips occupied author slots", () => {
    assert.deepEqual(allocateChunkIndices(3, [1]), [0, 2, 3]);
    assert.deepEqual(allocateChunkIndices(2, [0, 1, 2]), [3, 4]);
  });

  test("markUserOverride stamps metadata", () => {
    const meta = markUserOverride({ rag_index: true }, "author-1");
    assert.equal(meta.user_override, true);
    assert.equal(meta.user_override_by, "author-1");
    assert.ok(String(meta.user_override_at ?? "").length > 10);
  });
});

describe("ingestConverge user_override skip", () => {
  test("convergeUpsertWikiEntry skips update when user_override is set", async () => {
    const manuscriptId = "11111111-1111-1111-1111-111111111111";
    const fp = entityFingerprint(manuscriptId, "character", "Elphine");
    const sourceDocument = `wiki-entity/${manuscriptId}/${fp}`;
    let updateCalled = false;

    const supabase = {
      from(table: string) {
        assert.equal(table, "p4_narrative_library_chunks");
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return {
                          data: {
                            id: "chunk-1",
                            content: "Old excerpt content for testing override skip.",
                            metadata: { user_override: true, entity_fingerprint: fp },
                            is_deleted: false,
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          update() {
            updateCalled = true;
            return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
          },
        };
      },
    };

    const result = await convergeUpsertWikiEntry(supabase as never, {
      tenantId: "tenant-1",
      manuscriptId,
      entry: {
        title: "Elphine",
        excerpt: "New excerpt content that should not overwrite author edits here.",
        chunk_type: "character",
        tags: [],
        wiki_metadata: { outline_entity_kind: "character" },
      },
      sourcePrefix: "wiki-entity",
    });

    assert.equal(result.action, "skipped");
    assert.equal(result.userOverride, true);
    assert.equal(updateCalled, false);
    assert.equal(sourceDocument.includes(fp), true);
  });
});

describe("RPC migration snapshot", () => {
  test("is_deleted migration includes RPC filter", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
    const sql = await readFile(
      join(root, "packages/msgf/supabase/migrations/20260621120000_p4_chunk_is_deleted.sql"),
      "utf8"
    );
    assert.match(sql, /ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN/);
    assert.match(sql, /c\.is_deleted = false/);
  });
});
