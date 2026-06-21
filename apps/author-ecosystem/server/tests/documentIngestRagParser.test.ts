import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildIngestTabDiagnostics,
  inferDomainFromHeading,
  mergeRagProposedWiki,
  parseDocumentToRagSections,
  parseRagTagsFromText,
  splitBodyIntoRagSections,
} from "../src/lib/documentIngestRagParser.js";

describe("documentIngestRagParser", () => {
  test("parseRagTagsFromText extracts pipe-delimited tags", () => {
    const tags = parseRagTagsFromText(
      "Gravity is 0.8g\nRAG TAG: [Physics Law: Low Gravity] | RAG TAG: [History: Fall of Empire | Spoiler Level: Medium]"
    );
    assert.ok(tags.length >= 1);
    assert.equal(tags[0]?.name, "Physics Law: Low Gravity");
  });

  test("inferDomainFromHeading maps technology and fauna", () => {
    assert.equal(inferDomainFromHeading("TECHNOLOGY & PROPULSION").domain, "technology");
    assert.equal(inferDomainFromHeading("Terrestrial Fauna").domain, "species");
    assert.equal(inferDomainFromHeading("Ancient History").domain, "history");
  });

  test("splitBodyIntoRagSections splits caps headers", () => {
    const body = [
      "TECHNOLOGY",
      "Warp drives use dilithium crystals for field stability across long haul routes.",
      "",
      "FAUNA",
      "Sky whales migrate between gas giants every twelve orbital cycles.",
    ].join("\n");
    const sections = splitBodyIntoRagSections(body, "World");
    assert.ok(sections.length >= 2);
    assert.match(sections[0]?.heading ?? "", /TECHNOLOGY/i);
    assert.match(sections[1]?.heading ?? "", /FAUNA/i);
  });

  test("parseDocumentToRagSections pairs world bible sections with RAG metadata", () => {
    const doc = [
      "--- TAB: World Bible ---",
      "",
      "TECHNOLOGY",
      "Ships use ion drives limited to 0.2c within the habitable belt.",
      "RAG TAG: [Hard Magic: Ion Drive Cap]",
      "",
      "PLANETS",
      "Elphine Prime is a rocky world at 1.02 AU with breathable atmosphere.",
      "",
      "HISTORY",
      "The Collapse ended centralized rule two centuries before the story begins.",
      "RAG TAG: [History: The Collapse | Spoiler Level: Medium]",
    ].join("\n");

    const { proposedWiki, diagnostics } = parseDocumentToRagSections(
      doc,
      "world_bible",
      "ms-test-001"
    );

    assert.ok(proposedWiki.length >= 3, "expected technology, planets, history rows");
    assert.ok(
      proposedWiki.some((r) => String(r.wiki_metadata?.semantic_domain) === "technology"),
      "technology domain"
    );
    assert.ok(
      proposedWiki.some((r) => /history|collapse/i.test(r.title) || /collapse/i.test(r.excerpt)),
      "history section"
    );
    assert.ok(proposedWiki.every((r) => r.wiki_metadata?.rag_canon === true));
    assert.equal(diagnostics.length, proposedWiki.length);
    assert.ok(diagnostics.some((d) => d.plot_engine_panel === "settings" || d.plot_engine_panel === "environmental"));
  });

  test("mergeRagProposedWiki dedupes near-duplicate excerpts", () => {
    const text = "TECHNOLOGY\nIon drives cap at 0.2c for all civilian craft in this system.";
    const first = mergeRagProposedWiki([], text, "world_bible", "ms-1");
    const second = mergeRagProposedWiki(first.proposed, text, "world_bible", "ms-1");
    assert.equal(second.proposed.length, first.proposed.length);
  });

  test("buildIngestTabDiagnostics reads tab markers", () => {
    const text = "--- TAB: Outline ---\n\nChapter 1 beats\n\n--- TAB: World ---\n\nLore here";
    const tabs = buildIngestTabDiagnostics(text);
    assert.ok(tabs);
    assert.equal(tabs?.count, 2);
  });
});
