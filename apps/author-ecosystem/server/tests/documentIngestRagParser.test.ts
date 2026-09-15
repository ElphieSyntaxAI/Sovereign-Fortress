import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildIngestTabDiagnostics,
  inferDomainFromHeading,
  mergeRagProposedWiki,
  parseDocumentToRagSections,
  parseLoreLinksFromText,
  parseRagTagsFromText,
  parseSecondaryDomainsFromText,
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

  test("parseRagTagsFromText accepts [TAG:] alias and [RAG TAG:]", () => {
    const tags = parseRagTagsFromText(
      "[TAG: Religion: Twin Choir] and [RAG TAG: History: The Collapse | Spoiler Level: Medium]"
    );
    assert.ok(tags.some((t) => /twin choir|religion/i.test(t.name)));
    assert.ok(tags.some((t) => /collapse|history/i.test(t.name)));
  });

  test("parseLoreLinksFromText and Domains attach related_to + secondary_domains", () => {
    const doc = [
      "--- TAB: World Bible ---",
      "",
      "GOVERNMENT",
      "The Twin Choir Concordat seats clergy on the planetary council for ritual law.",
      "RAG TAG: [System_Law: Government]",
      "Domains: government, religion",
      "[Link: World_Bible | Field: Religion:Twin_Choir]",
      "",
      "GALAXIES",
      "Veil Arm is a barred spiral rimward of the Core with sparse jump beacons.",
      "RAG TAG: [Galaxy: Veil Arm]",
      "",
      "SPECIES",
      "Glowmoth: bioluminescent pollinator native to Kestrel Reach ice caves.",
      "RAG TAG: [Spatial_Bio: Glowmoth]",
      "Domains: species, fauna",
      "[Link: World_Bible | Field: Planet:Kestrel_Reach]",
    ].join("\n");

    const { proposedWiki } = parseDocumentToRagSections(doc, "world_bible", "ms-cross-domain");

    const gov = proposedWiki.find(
      (r) =>
        /government|concordat|system_law/i.test(r.title) ||
        /concordat|clergy/i.test(r.excerpt) ||
        Boolean(r.wiki_metadata?.rag_tag)
    );
    assert.ok(
      proposedWiki.some((r) => {
        const secondary = r.wiki_metadata?.secondary_domains;
        return Array.isArray(secondary) && secondary.includes("religion");
      }),
      "gov section keeps secondary religion domain"
    );
    assert.ok(
      proposedWiki.some((r) => {
        const related = r.wiki_metadata?.related_to;
        return Array.isArray(related) && related.some((x) => /world_bible|religion/i.test(JSON.stringify(x)));
      }),
      "Link lines become related_to"
    );
    assert.ok(
      proposedWiki.some(
        (r) =>
          /veil arm|galaxy/i.test(r.title) ||
          String(r.wiki_metadata?.semantic_domain) === "galaxy"
      ),
      "galaxy entity card"
    );
    assert.ok(
      proposedWiki.some(
        (r) => /glowmoth/i.test(r.title) || /glowmoth/i.test(r.excerpt)
      ),
      "species / spatial_bio card"
    );
    void gov;
  });

  test("inferDomainFromHeading maps technology, planet, religion, fauna, physics, galaxy", () => {
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
    assert.equal(inferDomainFromHeading("Galaxies of the Rim").domain, "galaxy");
  });

  test("parseLoreLinksFromText extracts sheet + field", () => {
    const links = parseLoreLinksFromText(
      "[Link: Character_Sheet | Field: Era_Beginning_Hook] see also [Link: Outline | Field: Hook]"
    );
    assert.equal(links.length, 2);
    assert.equal(links[0]?.sheet, "Character_Sheet");
    assert.equal(links[0]?.field, "Era_Beginning_Hook");
    assert.deepEqual(parseSecondaryDomainsFromText("Domains: government, religion"), [
      "government",
      "religion",
    ]);
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
