/**
 * Author BFF adapter — re-exports MSGF document compiler with Author-specific call signatures.
 */
import type { DocumentIngestSlot, IngestOutlineBeat, ProposedWikiEntry } from "./documentIngestGate.js";
import type { DocumentIngestStructuralSignals } from "./documentIngestSignals.js";
import type { SemanticRegion } from "./narrative/semanticChunking.js";

export type {
  DocumentIngestCompilerState,
  EntityRecord,
  PlotBeatRecord,
  WindowMetacognition,
  EnrichedIngestChunkTopology,
  StructuralMacroWindow,
  MultiPassCompilerResult,
} from "msgf/connector/server";

export {
  buildEntityFingerprint,
  buildBeatId,
  resolveEnrichedChunkTopology,
  compileStateToArtifacts,
  compilerStateDigest,
  buildStructuralMacroWindows,
  splitDocumentForConverge,
} from "msgf/connector/server";

import {
  runMultiPassDocumentCompiler as runMsgfCompiler,
  type DocumentIngestCompilerState,
  type MultiPassCompilerResult,
} from "msgf/connector/server";

function mapSignals(signals: DocumentIngestStructuralSignals) {
  return {
    tab_count: signals.tab_count,
    section_count: signals.section_count,
    markdown_table_rows: signals.markdown_table_rows,
    table_beat_estimate: signals.table_beat_estimate,
    has_chapter_headings: signals.has_chapter_headings,
    has_scene_grid: signals.has_scene_grid,
    summary: signals.summary,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toProposedWiki(rows: MultiPassCompilerResult["proposed"]): ProposedWikiEntry[] {
  return (rows ?? []).map((raw) => {
    const r = asRecord(raw);
    return {
      title: String(r.title ?? ""),
      excerpt: String(r.excerpt ?? ""),
      chunk_type: String(r.chunk_type ?? "other"),
      tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : [],
      wiki_metadata: asRecord(r.wiki_metadata ?? r.metadata),
    };
  });
}

function toOutlineBeats(rows: MultiPassCompilerResult["outline_beats"]): IngestOutlineBeat[] {
  return (rows ?? []).map((raw) => {
    const b = asRecord(raw);
    const fingerprints = Array.isArray(b.active_entity_fingerprints)
      ? b.active_entity_fingerprints.map((x) => String(x))
      : undefined;
    return {
      synopsis: String(b.synopsis ?? ""),
      order: Number(b.order ?? 0),
      title: b.title != null ? String(b.title) : undefined,
      chapter_number:
        b.chapter_number != null && Number.isFinite(Number(b.chapter_number))
          ? Number(b.chapter_number)
          : null,
      plot_point_order:
        b.plot_point_order != null && Number.isFinite(Number(b.plot_point_order))
          ? Number(b.plot_point_order)
          : undefined,
      beat_id: b.beat_id != null ? String(b.beat_id) : undefined,
      active_entity_fingerprints: fingerprints,
    };
  });
}

function toSemanticRegions(rows: MultiPassCompilerResult["semantic_regions"]): SemanticRegion[] {
  return (rows ?? []).map((raw) => {
    const r = asRecord(raw);
    return {
      domain: String(r.domain ?? "narrative"),
      anchor_excerpt: String(r.anchor_excerpt ?? ""),
      char_hint:
        r.char_hint != null && Number.isFinite(Number(r.char_hint)) ? Number(r.char_hint) : undefined,
    };
  });
}

export async function runMultiPassDocumentCompiler(params: {
  text: string;
  slot: DocumentIngestSlot;
  manuscriptId: string;
  signals: DocumentIngestStructuralSignals;
  slotHint: string;
  lineageReinforcement?: string | null;
  existingOutline?: string | null;
}): Promise<{
  state: DocumentIngestCompilerState;
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
  semantic_regions: SemanticRegion[];
  window_errors: MultiPassCompilerResult["window_errors"];
}> {
  const slotHint = [
    params.slotHint,
    params.lineageReinforcement ? `Vault lineage: ${params.lineageReinforcement}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await runMsgfCompiler({
    text: params.text,
    domain_profile: "author_narrative",
    manuscriptId: params.manuscriptId,
    slot: params.slot,
    signals: mapSignals(params.signals),
    slotHint,
    existingOutline: params.existingOutline,
  });

  return {
    state: result.state,
    proposed: toProposedWiki(result.proposed),
    outline_beats: toOutlineBeats(result.outline_beats),
    semantic_regions: toSemanticRegions(result.semantic_regions),
    window_errors: result.window_errors,
  };
}
