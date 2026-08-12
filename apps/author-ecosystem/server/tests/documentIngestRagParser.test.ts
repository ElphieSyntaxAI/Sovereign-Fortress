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

  test("inferDomainFromHeading maps technology, planet, religion, fauna, physics", () => {
    assert.equal(inferDomainFromHeading("TECHNOLOGY & PROPULSION").domain, "technology");
    assert.equal(inferDomainFromHeading("TECHNOLOGY & PROPULSION").stack_layer, "science");
    assert.equal(inferDomainFromHeading("PLANETS").domain, "planet");
    assert.equal(inferDomainFromHeading("PLANETS").location_kind, "planet");
    assert.equal(inferDomainFromHeading("RELIGION & FAITH").domain, "religion");
    assert.equal(inferDomainFromHeading("RELIGION & FAITH").stack_layer, "religion");
    assert.equal(inferDomainFromHeading("Terrestrial Fauna").domain, "fauna");
    assert.equal(inferDomainFromHeading("Ancient History").domain, "history");
    assert.equal(inferDomainFromHeading("PHYSICS LAWS").domain, "physics");
    assert.equal(inferDomainFromHeading("Themes & Motifs").domain, "theme");
  });

  test("parseDocumentToRagSections emits RAG TAG and markdown table foundation cards", () => {
    const doc = [
      "--- TAB: World Bible ---",
      "",
      "PHYSICS",
      "RAG TAG: [Physics Law: Frost Line] | RAG TAG: [Tech: Ion Drive Cap]",
      "Signal lag grows linearly beyond the belt.",
      "",
      "PLANETS",
      "| Name | Gravity | Climate |",
      "| ---- | ------- | ------- |",
      "| Elphine Prime | 0.98g | Temperate |",
      "| Kestrel Reach | 0.4g | Frozen |",
      "",
    ].join("\n");

    const { proposedWiki } = parseDocumentToRagSections(doc, "world_bible", "ms-foundation");

    assert.ok(
      proposedWiki.some(
        (r) =>
          Boolean(r.wiki_metadata?.rag_tag) &&
          Boolean(r.wiki_metadata?.foundation) &&
          /frost line|ion drive/i.test(r.title)
      ),
      "RAG TAG atoms become foundation cards"
    );
    assert.ok(
      proposedWiki.some(
        (r) =>
          Boolean(r.wiki_metadata?.table_row) &&
          /elphine prime/i.test(r.title) &&
          /0\.98g/i.test(r.excerpt)
      ),
      "planet table rows become foundation cards"
    );
    assert.ok(
      proposedWiki.some((r) => String(r.wiki_metadata?.semantic_domain) === "physics"),
      "physics foundation domain"
    );
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

  test("parseDocumentToRagSections emits entity fact cards not section dumps", () => {
    const doc = [
      "--- TAB: World Bible ---",
      "",
      "TECHNOLOGY",
      "Ion Drive: Ships use ion drives limited to 0.2c within the habitable belt.",
      "Warp Lattice: Field coils stabilize jump corridors between marked beacons.",
      "RAG TAG: [Hard Magic: Ion Drive Cap]",
      "",
      "PLANETS",
      "Elphine Prime is a rocky world at 1.02 AU with breathable atmosphere.",
      "Kestrel Reach orbits a red dwarf and hosts ice-mining stations.",
      "",
      "RELIGION",
      "The Twin Choir forbids AI priesthoods after the Collapse.",
      "Solace Rite marks arrivals with salt and void-oil.",
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

    assert.ok(proposedWiki.length >= 4, "expected multiple fact cards across domains");
    assert.ok(
      proposedWiki.some((r) => String(r.wiki_metadata?.semantic_domain) === "technology"),
      "technology domain"
    );
    assert.ok(
      proposedWiki.some((r) => /elphine prime/i.test(r.title) || /elphine prime/i.test(r.excerpt)),
      "planet named as its own card"
    );
    assert.ok(
      proposedWiki.every((r) => r.excerpt.length <= 520),
      "no chapter-length excerpts"
    );
    assert.ok(
      !proposedWiki.some(
        (r) =>
          /^planets$/i.test(r.title.trim()) &&
          /elphine prime/i.test(r.excerpt) &&
          /kestrel reach/i.test(r.excerpt) &&
          r.excerpt.length > 200
      ),
      "must not dump both planets under one PLANETS title blob"
    );
    assert.ok(
      proposedWiki.some((r) => String(r.wiki_metadata?.semantic_domain) === "religion"),
      "religion domain"
    );
    assert.ok(
      proposedWiki.some((r) => /history|collapse/i.test(r.title) || /collapse/i.test(r.excerpt)),
      "history section"
    );
    assert.equal(diagnostics.length, proposedWiki.length);
    assert.ok(
      diagnostics.some((d) => d.plot_engine_panel === "settings" || d.plot_engine_panel === "environmental")
    );
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
