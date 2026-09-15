import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { extractHeuristicChapterFacts } from "../src/lib/chapterFacts.js";
import { areNearDuplicateTexts } from "../src/lib/documentIngestCompile.js";
import {
  buildWikiProvenance,
  formatWikiProvenanceRef,
  mergeProvenanceOnManualEdit,
  readWikiProvenance,
} from "../src/lib/wikiProvenance.js";

describe("wikiProvenance", () => {
  test("build + format refs for three sources", () => {
    const upload = buildWikiProvenance({
      source: "planning_upload",
      channel: "document_ingest",
      manuscriptId: "ms-1",
      ingestSlot: "world_bible",
    });
    assert.equal(formatWikiProvenanceRef(upload), "Ref: Planning upload · world_bible");

    const manual = buildWikiProvenance({
      source: "planning_manual",
      channel: "planning_ui",
      manuscriptId: "ms-1",
    });
    assert.equal(formatWikiProvenanceRef(manual), "Ref: Planning (manual)");

    const live = buildWikiProvenance({
      source: "live_manuscript",
      channel: "chapter_facts",
      manuscriptId: "ms-1",
      chapterNumber: 12,
    });
    assert.match(formatWikiProvenanceRef(live), /Live manuscript · Ch\. 12/);
  });

  test("manual edit preserves origin provenance", () => {
    const origin = buildWikiProvenance({
      source: "planning_upload",
      channel: "document_ingest",
      ingestSlot: "character_sheet",
    });
    const merged = mergeProvenanceOnManualEdit({ provenance: origin });
    assert.equal(merged.source, "planning_upload");
    assert.equal(merged.last_edited_via, "planning_ui");
    assert.equal(readWikiProvenance({ provenance: merged })?.ingest_slot, "character_sheet");
  });
});

describe("chapterFacts heuristics", () => {
  test("extracts major events and POV from freewriting", () => {
    const text = [
      "Chapter 12 — Acina POV",
      "",
      "Acina arrived at the gate and revealed the Concordat seal to the Twin Choir.",
      "",
      "Later she fled the capital after the alliance was declared void.",
    ].join("\n");
    const cards = extractHeuristicChapterFacts(text, "ms-test", 12);
    assert.ok(cards.length >= 1, "expected at least one fact card");
    assert.ok(cards.every((c) => c.provenance?.source === "live_manuscript"));
    assert.ok(cards.some((c) => /arrived|fled|revealed|alliance/i.test(c.excerpt)));
  });

  test("near-duplicate detection still works for merge gate", () => {
    assert.equal(
      areNearDuplicateTexts(
        "The Twin Choir forbids AI priesthoods after the Collapse.",
        "The Twin Choir forbids AI priesthoods after the Collapse!"
      ),
      true
    );
  });
});
