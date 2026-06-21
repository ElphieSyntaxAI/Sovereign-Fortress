import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isAuthorLoreChunk,
  isAuthorOutlinePlotChunk,
  planningChunkTitle,
} from "../src/lib/planningChunkPreview.js";

describe("planningChunkPreview", () => {
  test("isAuthorOutlinePlotChunk excludes wiki-entry encyclopedia rows", () => {
    assert.equal(
      isAuthorOutlinePlotChunk(
        { lore_extraction: true, wiki_author_entry: true },
        "wiki-entry/ms/abc"
      ),
      false
    );
    assert.equal(
      isAuthorOutlinePlotChunk({ scene_card: true, file_import: true }, "file-import-plot-beat/ms/x"),
      true
    );
  });

  test("isAuthorLoreChunk includes wiki-entry sources", () => {
    assert.equal(isAuthorLoreChunk({ lore_extraction: true }, "wiki-entry/ms/id"), true);
  });

  test("planningChunkTitle prefers proposed_chunk_title", () => {
    const title = planningChunkTitle(
      { proposed_chunk_title: "Fauna of Elphine Prime" },
      "ignored body"
    );
    assert.equal(title, "Fauna of Elphine Prime");
  });
});
