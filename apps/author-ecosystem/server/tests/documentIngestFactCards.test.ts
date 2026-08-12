import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  distillDomainSectionToFactCards,
  isLoreDomainSectionHeading,
  splitLoreBodyIntoEntityBlocks,
} from "../src/lib/documentIngestFactCards.js";

describe("documentIngestFactCards", () => {
  test("isLoreDomainSectionHeading catches planets religion technology", () => {
    assert.equal(isLoreDomainSectionHeading("PLANETS"), true);
    assert.equal(isLoreDomainSectionHeading("Religion & Faith"), true);
    assert.equal(isLoreDomainSectionHeading("TECHNOLOGY"), true);
    assert.equal(isLoreDomainSectionHeading("Chapter 12"), false);
  });

  test("distillDomainSectionToFactCards splits planets into named cards", () => {
    const body = [
      "Elphine Prime is a rocky world at 1.02 AU with breathable atmosphere.",
      "",
      "Kestrel Reach orbits a red dwarf and hosts ice-mining stations.",
    ].join("\n");

    const cards = distillDomainSectionToFactCards({
      sectionHeading: "PLANETS",
      sectionPath: "World › PLANETS",
      body,
      inferred: {
        kind: "environment",
        domain: "planet",
        panel: "environmental",
        location_kind: "planet",
      },
    });

    assert.ok(cards.length >= 2);
    assert.ok(cards.some((c) => /elphine prime/i.test(c.title)));
    assert.ok(cards.every((c) => c.excerpt.length <= 420));
    assert.ok(cards.every((c) => c.metadata.fact_card === true));
    assert.ok(cards.every((c) => c.metadata.rag_canon === false));
  });

  test("splitLoreBodyIntoEntityBlocks handles named lead lines", () => {
    const blocks = splitLoreBodyIntoEntityBlocks(
      [
        "Ion Drive: Caps civilian craft at 0.2c inside the belt.",
        "Warp Lattice: Stabilizes jump corridors between marked beacons.",
      ].join("\n")
    );
    assert.ok(blocks.length >= 2);
  });
});
