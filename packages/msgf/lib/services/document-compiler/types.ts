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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * MSGF Document Compiler — shared types (headless library).
 */

export type DocumentCompilerDomainProfile =
  | "author_narrative"
  | "education_curriculum"
  | "generic";

export type AuthorNarrativeSlot = "world_bible" | "current_draft" | "character_sheet";

export type EntityKind =
  | "character"
  | "setting"
  | "item"
  | "faction"
  | "concept"
  | "standard"
  | "vocabulary"
  | "learning_objective"
  | "other";

export type StructuralMacroWindow = {
  window_id: string;
  index: number;
  total: number;
  label: string;
  text: string;
  char_start: number;
  char_end: number;
  kind: "chapter" | "scene" | "tab" | "section" | "paragraph" | "unit" | "lesson";
};

export type EntityRecord = {
  name: string;
  entity_fingerprint: string;
  kind: EntityKind;
  traits: string[];
  source_window_ids: string[];
};

export type PlotBeatRecord = {
  beat_id: string;
  synopsis: string;
  order: number;
  title?: string;
  chapter_number?: number | null;
  active_entity_fingerprints: string[];
  source_window_id: string;
};

export type SymbolicElement = {
  motif: string;
  resonance: string;
};

export type WindowMetacognition = {
  window_id: string;
  thematic_breadcrumbs: string[];
  symbolic_elements: SymbolicElement[];
  active_entity_fingerprints: string[];
  active_beat_ids: string[];
};

export type DocumentIngestCompilerState = {
  version: "3-pass-v1";
  domain_profile?: DocumentCompilerDomainProfile;
  macro_windows: StructuralMacroWindow[];
  entities: EntityRecord[];
  plot_beats: PlotBeatRecord[];
  window_metacognition: WindowMetacognition[];
  passes_completed: Array<"pass1" | "pass2" | "pass3">;
};

export type SemanticRegion = {
  domain: string;
  anchor_excerpt: string;
  char_hint?: number;
};

export type CompilerWikiArtifact = {
  title: string;
  excerpt: string;
  chunk_type: string;
  tags: string[];
  wiki_metadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CompilerBeatArtifact = {
  synopsis: string;
  order: number;
  title?: string;
  chapter_number?: number | null;
  plot_point_order?: number | null;
  beat_id?: string;
  active_entity_fingerprints?: string[];
};

export type EnrichedIngestChunkTopology = {
  manuscript_id: string;
  ingest_slot: string;
  wiki_visibility: "draft";
  ledger: "source_manuscript";
  active_entities: string[];
  plot_beats: string[];
  thematic_breadcrumbs: string[];
  symbolism: Record<string, string>;
};

export type DocumentCompilerStructuralSignals = {
  tab_count: number;
  section_count: number;
  markdown_table_rows: number;
  table_beat_estimate: number;
  has_chapter_headings: boolean;
  has_scene_grid: boolean;
  summary: string;
};

export type MultiPassCompilerResult = {
  state: DocumentIngestCompilerState;
  proposed: CompilerWikiArtifact[];
  outline_beats: CompilerBeatArtifact[];
  semantic_regions: SemanticRegion[];
  window_errors: Array<{ window_id: string; pass: string; message: string }>;
};

export type CompilerRunParams = {
  text: string;
  domain_profile: DocumentCompilerDomainProfile;
  manuscriptId: string;
  slot?: AuthorNarrativeSlot;
  subject_domain?: "ela" | "history" | "math" | "science" | "general";
  signals?: DocumentCompilerStructuralSignals;
  slotHint?: string;
  lineageReinforcement?: string | null;
  existingOutline?: string | null;
};
