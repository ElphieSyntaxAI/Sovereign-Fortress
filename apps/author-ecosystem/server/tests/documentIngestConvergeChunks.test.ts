import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { splitDocumentForConverge } from "../src/lib/documentIngestConvergeChunks.js";
import { splitBodyIntoRagSections } from "../src/lib/documentIngestRagParser.js";

describe("documentIngestConvergeChunks", () => {
  test("splitDocumentForConverge returns single chunk for short text", () => {
    const chunks = splitDocumentForConverge("Short lore doc.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.total, 1);
  });

  test("splitDocumentForConverge splits long tabbed docs into multiple chunks", () => {
    const tab = (n: number) => `--- TAB: Section ${n} ---\n\n${"Lore paragraph. ".repeat(4000)}`;
    const text = [1, 2, 3].map(tab).join("\n");
    const chunks = splitDocumentForConverge(text);
    assert.ok(chunks.length >= 2, "expected multiple CONVERGE chunks for long tabbed doc");
  });
});

describe("documentIngestRagParser title case", () => {
  test("splitBodyIntoRagSections splits Title Case domain headers", () => {
    const body = [
      "Terrestrial Species",
      "The Aelari possess bioluminescent skin and migrate between gas giants.",
      "",
      "Ancient Timeline",
      "The Collapse ended centralized rule two centuries before the story begins.",
    ].join("\n");
    const sections = splitBodyIntoRagSections(body, "World");
    assert.ok(sections.length >= 2);
    assert.match(sections[1]?.heading ?? "", /Timeline|Ancient/i);
  });
});
