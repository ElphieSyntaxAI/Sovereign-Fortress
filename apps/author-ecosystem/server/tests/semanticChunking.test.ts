import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import {
  buildBoundaryHintsForIngest,
  chunkTextSemantic,
  detectEmbedDropBoundaries,
  detectHeuristicBoundaries,
  resolveSemanticRegionsToBoundaries,
} from "../src/lib/narrative/semanticChunking.js";
import { parseSemanticRegions } from "../src/lib/documentIngestLlmParse.js";

const WORLD_BIBLE = `
TECHNOLOGY AND PROPULSION

The fleet uses ion drives rated at twelve kilonewtons per vessel. Each cruiser carries
four redundant reactors with magnetic containment fields that must never fail during
transit between systems. Engineers calibrate thrust vectors nightly.

GOVERNMENT AND POLITICS

The High Council governs twelve provinces through appointed magistrates. Elections occur
every seven years unless a succession crisis triggers emergency rule. Tax policy favors
orbital stations over planetary colonies.

SPECIES AND BIOLOGY

The Aelari possess bioluminescent skin patterns that shift with emotional state. Their
lifespan averages two centuries in low gravity. Hybrid offspring with humans remain rare
and politically sensitive across border worlds.
`.trim();

function repeatWords(text: string, times: number): string {
  return Array.from({ length: times }, () => text).join("\n\n");
}

describe("semanticChunking heuristics", () => {
  test("detects ALL-CAPS and domain keyword boundaries in unstyled world bible", () => {
    const bounds = detectHeuristicBoundaries(WORLD_BIBLE);
    assert.ok(bounds.length >= 2, `expected >=2 boundaries, got ${bounds.length}`);
    const labels = bounds.map((b) => (b.label ?? "").toLowerCase());
    assert.ok(
      labels.some((l) => l.includes("technology") || l.includes("propulsion")),
      "technology section boundary"
    );
    assert.ok(
      labels.some((l) => l.includes("government") || l.includes("politics")),
      "government section boundary"
    );
  });

  test("resolveSemanticRegionsToBoundaries maps anchor excerpts to offsets", () => {
    const regions = parseSemanticRegions([
      {
        domain: "technology",
        anchor_excerpt: "The fleet uses ion drives rated at twelve kilonewtons per vessel.",
        char_hint: 0,
      },
      {
        domain: "government",
        anchor_excerpt: "The High Council governs twelve provinces through appointed magistrates.",
      },
    ]);
    const bounds = resolveSemanticRegionsToBoundaries(regions, WORLD_BIBLE);
    assert.equal(bounds.length, 2);
    assert.equal(bounds[0]?.source, "converge");
    assert.ok((bounds[1]?.charOffset ?? 0) > (bounds[0]?.charOffset ?? 0));
  });

  test("buildBoundaryHintsForIngest merges heuristics and CONVERGE regions", () => {
    const regions = parseSemanticRegions([
      {
        domain: "species",
        anchor_excerpt: "The Aelari possess bioluminescent skin patterns that shift with emotional state.",
      },
    ]);
    const heuristicOnly = buildBoundaryHintsForIngest(WORLD_BIBLE);
    const merged = buildBoundaryHintsForIngest(WORLD_BIBLE, { semanticRegions: regions });
    assert.ok(merged.length >= 2);
    const speciesOffset = WORLD_BIBLE.indexOf("The Aelari possess");
    assert.ok(
      merged.some((b) => Math.abs(b.charOffset - speciesOffset) < 40),
      "species anchor resolves to a boundary near source offset"
    );
    assert.ok(merged.length >= heuristicOnly.length);
  });
});

describe("semanticChunking pack", () => {
  test("respects 500-word cap without crossing hard boundaries", async () => {
    const longTech = repeatWords(
      "Technology paragraph about reactors thrust vectors and magnetic containment fields in deep space.",
      80
    );
    const longGov = repeatWords(
      "Government paragraph about councils magistrates elections tax policy and provincial law.",
      80
    );
    const text = `TECHNOLOGY\n\n${longTech}\n\nGOVERNMENT\n\n${longGov}`;
    const boundaries = detectHeuristicBoundaries(text);
    const { chunks } = await chunkTextSemantic(text, { boundaries, maxWords: 500, overlapWords: 50 });

    assert.ok(chunks.length >= 2, "expected multiple shards for long multi-domain doc");
    for (const chunk of chunks) {
      const words = chunk.split(/\s+/).filter(Boolean).length;
      assert.ok(words <= 500, `chunk exceeded 500 words: ${words}`);
    }

    const techOnly = chunks.filter((c) => /reactor|Technology/i.test(c));
    const govOnly = chunks.filter((c) => /magistrate|Government|council/i.test(c));
    assert.ok(techOnly.length >= 1);
    assert.ok(govOnly.length >= 1);
    assert.ok(
      !chunks.some((c) => /reactor/i.test(c) && /magistrate/i.test(c)),
      "no shard should merge technology and government paragraphs"
    );
  });

  test("short documents under 400 words stay a single shard", async () => {
    const short = "A brief note about one topic only.";
    const { chunks, shardMeta } = await chunkTextSemantic(short);
    assert.equal(chunks.length, 1);
    assert.equal(shardMeta[0]?.boundary_sources[0], "short_doc");
  });
});

describe("semanticChunking embed drop", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  test("embed similarity drop inserts boundary between dissimilar units", async () => {
    process.env = { ...env, MSGF_SEMANTIC_CHUNK_THRESHOLD: "0.72" };
    const text = [
      "Ion drives and reactor calibration for deep space cruisers.",
      "Ion drives and magnetic containment for deep space cruisers.",
      "",
      "The High Council appoints magistrates and collects orbital taxes.",
      "The High Council governs provinces through elected magistrates.",
    ].join("\n\n");

    let call = 0;
    const embedBatch = async (texts: string[]) => {
      return texts.map(() => {
        call += 1;
        if (call <= 2) return [1, 0, 0];
        if (call === 3) return [0, 1, 0];
        return [0, 0, 1];
      });
    };

    const bounds = await detectEmbedDropBoundaries(text, embedBatch);
    assert.ok(bounds.length >= 1);
    assert.equal(bounds[0]?.source, "embed");
  });
});
