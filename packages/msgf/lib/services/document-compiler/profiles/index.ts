/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import type {
  CompilerBeatArtifact,
  CompilerWikiArtifact,
  DocumentIngestCompilerState,
  EntityKind,
  SemanticRegion,
} from "../types";

export type DomainProfileConfig = {
  id: "author_narrative" | "education_curriculum" | "generic";
  entityKinds: EntityKind[];
  pass1SystemPrompt: string;
  pass2SystemPrompt: string;
  pass3SystemPrompt: string;
  compileArtifacts: (state: DocumentIngestCompilerState, params: {
    manuscriptId: string;
    slot?: string;
    subject_domain?: string;
  }) => {
    proposed: CompilerWikiArtifact[];
    outline_beats: CompilerBeatArtifact[];
    semantic_regions: SemanticRegion[];
  };
};

function entityWikiType(kind: EntityKind): string {
  switch (kind) {
    case "character":
      return "character";
    case "theme":
      return "theme";
    case "setting":
    case "planet":
    case "technology":
    case "religion":
    case "physics":
    case "magic":
    case "species":
    case "fauna":
    case "flora":
    case "history":
    case "government":
    case "culture":
      return "location";
    case "item":
      return "object";
    case "faction":
      return "faction";
    case "concept":
    case "standard":
    case "vocabulary":
    case "learning_objective":
      return "concept";
    default:
      return "note";
  }
}

function authorEntityWikiMeta(kind: EntityKind): Record<string, unknown> {
  switch (kind) {
    case "character":
      return { outline_entity_kind: "character", semantic_domain: "character" };
    case "planet":
      return {
        outline_entity_kind: "environment",
        semantic_domain: "planet",
        location_kind: "planet",
        stack_layer: "environment",
        foundation: true,
      };
    case "religion":
      return {
        outline_entity_kind: "environment",
        semantic_domain: "religion",
        stack_layer: "religion",
        foundation: true,
      };
    case "technology":
      return {
        outline_entity_kind: "setting",
        semantic_domain: "technology",
        stack_layer: "science",
        world_bible_section: "technology",
        foundation: true,
      };
    case "physics":
      return {
        outline_entity_kind: "setting",
        semantic_domain: "physics",
        stack_layer: "physics",
        foundation: true,
      };
    case "magic":
      return {
        outline_entity_kind: "setting",
        semantic_domain: "magic",
        stack_layer: "magic",
        foundation: true,
      };
    case "species":
    case "fauna":
      return {
        outline_entity_kind: "environment",
        semantic_domain: kind === "fauna" ? "fauna" : "species",
        stack_layer: "fauna",
        foundation: true,
      };
    case "flora":
      return {
        outline_entity_kind: "environment",
        semantic_domain: "flora",
        stack_layer: "flora",
        foundation: true,
      };
    case "history":
      return {
        outline_entity_kind: "note",
        semantic_domain: "history",
        stack_layer: "history",
        foundation: true,
      };
    case "government":
      return {
        outline_entity_kind: "note",
        semantic_domain: "government",
        stack_layer: "government",
        foundation: true,
      };
    case "culture":
      return {
        outline_entity_kind: "note",
        semantic_domain: "culture",
        stack_layer: "cultural",
        foundation: true,
      };
    case "theme":
      return { outline_entity_kind: "theme", semantic_domain: "theme", foundation: true };
    case "setting":
      return { outline_entity_kind: "environment", semantic_domain: "setting", foundation: true };
    case "faction":
      return {
        outline_entity_kind: "note",
        semantic_domain: "government",
        stack_layer: "government",
        foundation: true,
      };
    default:
      return { outline_entity_kind: "note", semantic_domain: kind, foundation: true };
  }
}

const AUTHOR_FOUNDATION_KINDS: EntityKind[] = [
  "character",
  "setting",
  "item",
  "faction",
  "planet",
  "religion",
  "technology",
  "physics",
  "magic",
  "species",
  "history",
  "government",
  "culture",
  "fauna",
  "flora",
  "theme",
  "other",
];

export const authorNarrativeProfile: DomainProfileConfig = {
  id: "author_narrative",
  entityKinds: AUTHOR_FOUNDATION_KINDS,
  pass1SystemPrompt: [
    "You are Pass 1 of a 3-pass document ingest compiler for AUTHOR narrative onboarding.",
    "Extract named entities from ONE macro-window only. Use stable entity_fingerprint slugs.",
    "FACTS ONLY: each trait must be one atomic world fact (≤12 words). No dialogue, no scene narration, no filler.",
    "Map every story foundation that appears: physics, magic, planets, technology, religion, culture, fauna, flora, species, history, government, characters, themes — not section titles.",
    'Output ONLY JSON: {"entities":[{"name":"string","kind":"character|setting|item|faction|planet|religion|technology|physics|magic|species|history|government|culture|fauna|flora|theme|other","traits":["string"]}]}',
    "Do not invent entities absent from the window text. Do not copy whole paragraphs into traits.",
  ].join("\n"),
  pass2SystemPrompt: [
    "You are Pass 2 of a 3-pass document ingest compiler for AUTHOR narrative.",
    "Map plot beats / scene rows for ONE macro-window. Inject entity_fingerprint references from the dictionary.",
    'Output ONLY JSON: {"plot_beats":[{"synopsis":"string","order":0,"title":"string","chapter_number":null,"active_entity_fingerprints":["fingerprint_slug"]}]}',
    "Preserve tabular row boundaries — one table row → one beat when appropriate.",
  ].join("\n"),
  pass3SystemPrompt: [
    "You are Pass 3 of a 3-pass document ingest compiler for AUTHOR narrative.",
    "Extract metacognitive breadcrumbs for ONE macro-window using local entity/beat context only.",
    'Output ONLY JSON: {"thematic_breadcrumbs":["#tag"],"symbolic_elements":[{"motif":"string","resonance":"string"}],"active_entity_fingerprints":[],"active_beat_ids":[]}',
  ].join("\n"),
  compileArtifacts(state, params) {
    const proposed: CompilerWikiArtifact[] = [];

    for (const entity of state.entities) {
      const traits = entity.traits
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0 && t.length <= 120)
        .slice(0, 8);
      const excerpt =
        traits.length > 0
          ? `${entity.name}: ${traits.join(". ")}.`
          : `${entity.name} (${entity.kind}).`;
      if (excerpt.length < 40) continue;
      const meta = authorEntityWikiMeta(entity.kind);
      proposed.push({
        title: entity.name,
        excerpt: excerpt.length >= 40 ? excerpt : `${excerpt} Document inventory entry.`,
        chunk_type: entityWikiType(entity.kind),
        tags: ["multi_pass", "pass1_entity", "fact_card", entity.kind],
        wiki_metadata: {
          ...meta,
          entity_fingerprint: entity.entity_fingerprint,
          multi_pass: true,
          fact_card: true,
        },
      });
    }

    for (const meta of state.window_metacognition) {
      for (const sym of meta.symbolic_elements) {
        const excerpt = `Motif "${sym.motif}": ${sym.resonance}. Tags: ${meta.thematic_breadcrumbs.join(", ") || "—"}.`;
        if (excerpt.length < 40) continue;
        proposed.push({
          title: sym.motif,
          excerpt,
          chunk_type: "theme",
          tags: ["multi_pass", "pass3_metacognitive", ...meta.thematic_breadcrumbs],
          wiki_metadata: {
            outline_entity_kind: "theme",
            thematic_breadcrumbs: meta.thematic_breadcrumbs,
            symbolism: sym,
            multi_pass: true,
          },
        });
      }
    }

    const outline_beats: CompilerBeatArtifact[] = state.plot_beats.map((b) => ({
      synopsis: b.synopsis,
      order: b.order,
      title: b.title,
      chapter_number: b.chapter_number,
      plot_point_order: b.order + 1,
      beat_id: b.beat_id,
      active_entity_fingerprints: b.active_entity_fingerprints,
    }));

    const semantic_regions: SemanticRegion[] = state.window_metacognition
      .flatMap((w) => {
        const win = state.macro_windows.find((m) => m.window_id === w.window_id);
        if (!win) return [];
        const anchor = win.text.slice(0, Math.min(120, win.text.length)).trim();
        if (anchor.length < 40) return [];
        return [
          {
            domain: w.thematic_breadcrumbs[0]?.replace(/^#/, "") || "narrative",
            anchor_excerpt: anchor,
            char_hint: win.char_start,
          },
        ];
      })
      .slice(0, 24);

    void params;
    return { proposed, outline_beats, semantic_regions };
  },
};

export const educationCurriculumProfile: DomainProfileConfig = {
  id: "education_curriculum",
  entityKinds: ["concept", "standard", "vocabulary", "learning_objective", "other"],
  pass1SystemPrompt: [
    "You are Pass 1 of a 3-pass curriculum document compiler for K-12 education.",
    "Extract concepts, standards, vocabulary, and learning objectives from ONE macro-window.",
    'Output ONLY JSON: {"entities":[{"name":"string","kind":"concept|standard|vocabulary|learning_objective|other","traits":["string"]}]}',
  ].join("\n"),
  pass2SystemPrompt: [
    "You are Pass 2 of a curriculum document compiler.",
    "Map lesson sequence beats / instructional steps for ONE macro-window.",
    'Output ONLY JSON: {"plot_beats":[{"synopsis":"string","order":0,"title":"string","active_entity_fingerprints":["fingerprint_slug"]}]}',
  ].join("\n"),
  pass3SystemPrompt: [
    "You are Pass 3 of a curriculum document compiler.",
    "Extract pedagogical breadcrumbs: misconceptions, prerequisites, skill tags.",
    'Output ONLY JSON: {"thematic_breadcrumbs":["#misconception","#prerequisite"],"symbolic_elements":[],"active_entity_fingerprints":[],"active_beat_ids":[]}',
  ].join("\n"),
  compileArtifacts(state, params) {
    const proposed: CompilerWikiArtifact[] = state.entities.map((e) => ({
      title: e.name,
      excerpt: e.traits.length ? e.traits.join("; ") : e.name,
      chunk_type: e.kind,
      tags: [e.kind, ...(params.subject_domain ? [params.subject_domain] : []), ...e.traits.slice(0, 3)],
      metadata: {
        entity_fingerprint: e.entity_fingerprint,
        subject_domain: params.subject_domain ?? "general",
        source_window_ids: e.source_window_ids,
      },
    }));

    const outline_beats: CompilerBeatArtifact[] = [...state.plot_beats]
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        synopsis: b.synopsis,
        order: b.order,
        title: b.title,
        beat_id: b.beat_id,
        active_entity_fingerprints: b.active_entity_fingerprints,
      }));

    const semantic_regions: SemanticRegion[] = state.macro_windows.map((w) => ({
      domain: w.kind,
      anchor_excerpt: w.text.slice(0, 240).replace(/\s+/g, " ").trim(),
      char_hint: w.char_start,
    }));

    return { proposed, outline_beats, semantic_regions };
  },
};

export const genericProfile: DomainProfileConfig = {
  id: "generic",
  entityKinds: ["concept", "other"],
  pass1SystemPrompt: [
    "You are Pass 1 of a generic 3-pass document compiler.",
    'Output ONLY JSON: {"entities":[{"name":"string","kind":"concept|other","traits":["string"]}]}',
  ].join("\n"),
  pass2SystemPrompt: [
    "You are Pass 2 of a generic document compiler.",
    'Output ONLY JSON: {"plot_beats":[{"synopsis":"string","order":0,"active_entity_fingerprints":[]}]}',
  ].join("\n"),
  pass3SystemPrompt: [
    "You are Pass 3 of a generic document compiler.",
    'Output ONLY JSON: {"thematic_breadcrumbs":[],"symbolic_elements":[],"active_entity_fingerprints":[],"active_beat_ids":[]}',
  ].join("\n"),
  compileArtifacts: educationCurriculumProfile.compileArtifacts,
};

const PROFILES: Record<string, DomainProfileConfig> = {
  author_narrative: authorNarrativeProfile,
  education_curriculum: educationCurriculumProfile,
  generic: genericProfile,
};

export function resolveDomainProfile(domain: string): DomainProfileConfig {
  return PROFILES[domain] ?? genericProfile;
}
