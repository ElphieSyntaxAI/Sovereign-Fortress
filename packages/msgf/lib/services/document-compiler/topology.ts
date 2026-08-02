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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import type { DocumentIngestCompilerState, EnrichedIngestChunkTopology } from "./types";

export function resolveEnrichedChunkTopology(params: {
  charStart: number;
  charEnd: number;
  compilerState: DocumentIngestCompilerState;
  manuscriptId: string;
  ingestSlot: string;
}): EnrichedIngestChunkTopology {
  const { compilerState, manuscriptId, ingestSlot, charStart, charEnd } = params;
  const mid = (charStart + charEnd) / 2;

  const windows = compilerState.macro_windows.filter(
    (w) => mid >= w.char_start && mid <= w.char_end
  );
  const windowIds = new Set(windows.map((w) => w.window_id));

  const active_entities = new Set<string>();
  const plot_beats = new Set<string>();
  const thematic_breadcrumbs = new Set<string>();
  const symbolism: Record<string, string> = {};

  for (const entity of compilerState.entities) {
    if (entity.source_window_ids.some((id) => windowIds.has(id))) {
      active_entities.add(entity.entity_fingerprint);
    }
  }

  for (const beat of compilerState.plot_beats) {
    if (windowIds.has(beat.source_window_id)) {
      plot_beats.add(beat.beat_id);
      for (const fp of beat.active_entity_fingerprints) active_entities.add(fp);
    }
  }

  for (const meta of compilerState.window_metacognition) {
    if (!windowIds.has(meta.window_id)) continue;
    for (const tag of meta.thematic_breadcrumbs) thematic_breadcrumbs.add(tag);
    for (const fp of meta.active_entity_fingerprints) active_entities.add(fp);
    for (const bid of meta.active_beat_ids) plot_beats.add(bid);
    for (const sym of meta.symbolic_elements) {
      if (sym.motif) symbolism[sym.motif] = sym.resonance || sym.motif;
    }
  }

  return {
    manuscript_id: manuscriptId,
    ingest_slot: ingestSlot,
    wiki_visibility: "draft",
    ledger: "source_manuscript",
    active_entities: [...active_entities],
    plot_beats: [...plot_beats],
    thematic_breadcrumbs: [...thematic_breadcrumbs],
    symbolism,
  };
}

export function buildEducationChunkTopology(
  charStart: number,
  charEnd: number,
  compilerState: DocumentIngestCompilerState | null | undefined
): Record<string, unknown> | null {
  if (!compilerState?.version) return null;
  const base = resolveEnrichedChunkTopology({
    charStart,
    charEnd,
    compilerState,
    manuscriptId: "",
    ingestSlot: "curriculum",
  });
  return {
    active_entities: base.active_entities,
    plot_beats: base.plot_beats,
    thematic_breadcrumbs: base.thematic_breadcrumbs,
    symbolism: base.symbolism,
    compiler_version: compilerState.version,
  };
}
