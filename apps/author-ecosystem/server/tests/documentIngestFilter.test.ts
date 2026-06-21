import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  filterProposedWikiForCommit,
  isOutlineBeatWikiDuplicate,
  isSubstantivePlotBeat,
  isSubstantiveWikiExcerpt,
} from "../src/lib/documentIngestFilter.js";

describe("documentIngestFilter", () => {
  test("isSubstantiveWikiExcerpt rejects title-only placeholders", () => {
    assert.equal(isSubstantiveWikiExcerpt("Chapter 3", "Chapter 3"), false);
    assert.equal(
      isSubstantiveWikiExcerpt(
        "Elena discovers the sealed vault beneath the spire and confronts the keeper about the exodus.",
        "The vault"
      ),
      true
    );
  });

  test("isOutlineBeatWikiDuplicate flags scene cards and file-import plot points", () => {
    assert.equal(
      isOutlineBeatWikiDuplicate({
        title: "Beat 1",
        excerpt: "Something happens",
        chunk_type: "event",
        tags: ["file_import"],
        wiki_metadata: { scene_card: true, outline_entity_kind: "plot_point" },
      }),
      true
    );
    assert.equal(
      isOutlineBeatWikiDuplicate({
        title: "Pavoc",
        excerpt: "A veteran scout who leads the exodus party through the outer storms.",
        chunk_type: "character",
        tags: [],
        wiki_metadata: { outline_entity_kind: "character" },
      }),
      false
    );
  });

  test("filterProposedWikiForCommit drops outline duplicates", () => {
    const kept = filterProposedWikiForCommit([
      {
        title: "Scene 2",
        excerpt: "Short",
        chunk_type: "event",
        tags: ["file_import"],
        wiki_metadata: { scene_card: true, outline_entity_kind: "plot_point" },
      },
      {
        title: "Isman",
        excerpt:
          "Isman is the keeper of the vault records and knows every name on the exodus manifest.",
        chunk_type: "character",
        tags: ["character"],
        wiki_metadata: { outline_entity_kind: "character" },
      },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.title, "Isman");
  });

  test("isSubstantivePlotBeat accepts chapter synopses with real prose", () => {
    assert.equal(
      isSubstantivePlotBeat({
        title: "Chapter 4",
        synopsis:
          "Chapter 4 — Split POV\nElena runs through the lower halls while Pavoc holds the gate against the storm.",
        chapter_number: 4,
        plot_point_order: 4,
      }),
      true
    );
  });
});
