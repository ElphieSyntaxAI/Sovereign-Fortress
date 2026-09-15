import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  slotDefaultMetadata,
  type DocumentIngestSlot,
  type IngestOutlineBeat,
  type ProposedWikiEntry,
} from "./documentIngestGate.js";
import { compileDocumentIngest } from "./documentIngestCompile.js";
import {
  filterOutlineBeatsForCommit,
  filterProposedWikiForCommit,
} from "./documentIngestFilter.js";
import {
  buildManuscriptOutlineFromBeats,
  normalizeProposedWikiEntry,
  type IngestPlotBeat,
} from "./documentIngestOutline.js";
import {
  buildBoundaryHintsForIngest,
  type SemanticRegion,
} from "./narrative/semanticChunking.js";
import { IngestionService } from "./narrative/IngestionService.js";
import {
  addConvergenceStats,
  convergeUpsertPlotBeats,
  type ConvergenceStats,
} from "./ingestConverge.js";
import { buildAuthorDocumentSweepFiles } from "./documentIngestMsgfSweep.js";
import { pipeToMsgfIngestService } from "./fetchManuscript.js";
import type { DocumentIngestCompilerState } from "./documentIngestMultiPassCompiler.js";
import { writeWikiEntryWithMergeGate, provenanceForIngestSlot } from "./wikiWriteGate.js";
import type { LoreMergeRecord } from "./wikiLoreMerges.js";

export type PlanningIngestSnapshot = {
  manuscript_outline: string;
  plot_beats: Array<{
    synopsis: string;
    order: number;
    title?: string;
    pov_mode?: string;
    pov_names?: string[];
    chapter_number?: number | null;
  }>;
  scene_card_count: number;
  wiki_entry_count: number;
  compile_stats?: {
    outline_beats_before: number;
    outline_beats_after: number;
    wiki_entries_before: number;
    wiki_entries_after: number;
    source_chars_before?: number;
    source_chars_after?: number;
  };
  convergence?: { lore: ConvergenceStats; plot: ConvergenceStats };
  lore_merges_opened?: number;
  lore_merge_ids?: string[];
};

export async function commitDocumentIngestToBackend(params: {
  supabase: SupabaseClient;
  tenantId: string;
  manuscriptId: string;
  slot: DocumentIngestSlot;
  filename: string;
  sourceText: string;
  proposed: ProposedWikiEntry[];
  outlineBeats: IngestOutlineBeat[];
  syncMsgfBrain?: boolean;
  semanticRegions?: SemanticRegion[];
  compilerState?: DocumentIngestCompilerState;
}): Promise<{
  lore_ingest: { chunksTotal: number; chunksInserted: number } | null;
  plot_ingest: { chunksTotal: number; chunksInserted: number } | null;
  wiki_chunk_ids: string[];
  msgf_ingest: unknown;
  planning: PlanningIngestSnapshot;
  lore_merges?: LoreMergeRecord[];
}> {
  const { supabase, tenantId, manuscriptId, slot, filename } = params;
  const compiled = compileDocumentIngest({
    outlineBeats: params.outlineBeats as IngestPlotBeat[],
    proposedWiki: filterProposedWikiForCommit(params.proposed),
    sourceText: params.sourceText,
  });
  const sourceText = compiled.source_text ?? params.sourceText;
  const normalized = compiled.proposed_wiki.map((e) =>
    normalizeProposedWikiEntry(e, manuscriptId, slot)
  );
  const beats = filterOutlineBeatsForCommit(compiled.outline_beats);

  const ingestion = new IngestionService(supabase);
  let lore_ingest: { chunksTotal: number; chunksInserted: number } | null = null;
  let plot_ingest: { chunksTotal: number; chunksInserted: number } | null = null;

  const boundaryHints = buildBoundaryHintsForIngest(sourceText, {
    semanticRegions: params.semanticRegions,
  });

  try {
    lore_ingest = await ingestion.ingestManuscript({
      tenantId,
      sourceDocument: `file_import_${slot}/${manuscriptId}`,
      chunkType: "lore",
      buffer: Buffer.from(sourceText, "utf8"),
      filename,
      boundaryHints,
      semanticRegions: params.semanticRegions,
      compilerState: params.compilerState,
      ingestSlot: slot,
      manuscriptId,
      metadata: {
        manuscript_id: manuscriptId,
        ingest_slot: slot,
        file_import: true,
        rag_index: true,
        type: "lore",
        wiki_visibility: "draft",
        ledger: "source_manuscript",
        file_import_committed_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Document ingest failed: narrative library (lore) embed — ${msg}`);
  }

  if (!lore_ingest || lore_ingest.chunksInserted <= 0) {
    throw new Error(
      "Document ingest failed: narrative library wrote 0 lore chunks — check embeddings / source text"
    );
  }

  const outlineText = buildManuscriptOutlineFromBeats(beats);
  if (outlineText.length >= 20) {
    const { error: outlineErr } = await supabase
      .from("p4_manuscripts")
      .update({
        outline: outlineText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", manuscriptId);
    if (outlineErr) console.warn("[commitDocumentIngest] outline update", outlineErr.message);

    try {
      plot_ingest = await ingestion.ingestManuscript({
        tenantId,
        sourceDocument: `file_import_outline/${manuscriptId}`,
        chunkType: "plot",
        buffer: Buffer.from(outlineText, "utf8"),
        filename: "import-outline.txt",
        boundaryHints,
        semanticRegions: params.semanticRegions,
        compilerState: params.compilerState,
        ingestSlot: slot,
        manuscriptId,
        metadata: {
          outline: true,
          is_outline: true,
          manuscript_id: manuscriptId,
          file_import: true,
          rag_index: true,
          ingest_slot: slot,
          wiki_visibility: "draft",
          ledger: "source_manuscript",
        },
      });
    } catch (e) {
      console.warn("[commitDocumentIngest] plot vector", e);
    }
  }

  let convergence: { lore: ConvergenceStats; plot: ConvergenceStats } = {
    lore: { inserted: 0, updated: 0, skipped: 0, skipped_user_override: 0 },
    plot: { inserted: 0, updated: 0, skipped: 0, skipped_user_override: 0 },
  };

  if (beats.length > 0) {
    try {
      const plotStats = await convergeUpsertPlotBeats(supabase, {
        tenantId,
        manuscriptId,
        beats: beats
          .map((b, i) => ({ beat: b, order: i }))
          .filter(({ beat }) => beat.synopsis.trim().length >= 20)
          .map(({ beat, order }) => {
            const isChapter = beat.chapter_number != null;
            return {
              synopsis: beat.synopsis.trim(),
              order,
              metadata: {
                outline: true,
                is_outline: true,
                manuscript_id: manuscriptId,
                scene_card: true,
                plot_point_order: beat.plot_point_order ?? beat.chapter_number ?? order + 1,
                chapter_number: beat.chapter_number ?? null,
                beat_title: beat.title,
                pov_mode: beat.pov_mode,
                pov_names: beat.pov_names,
                ingest_slot: slot,
                file_import: true,
                ledger: "wiki_snapshot",
                wiki_visibility: "draft",
                outline_entity_kind: isChapter ? "chapter" : "plot_point",
                proposed_chunk_title: beat.title?.trim() || undefined,
                ...(beat.beat_id ? { beat_id: beat.beat_id } : {}),
                ...(beat.active_entity_fingerprints?.length
                  ? { active_entities: beat.active_entity_fingerprints }
                  : {}),
              },
            };
          }),
        sourcePrefix: "file-import-plot-beat",
      });
      convergence.plot = addConvergenceStats(convergence.plot, plotStats);
    } catch (plotRowErr) {
      console.warn("[commitDocumentIngest] per-beat plot converge", plotRowErr);
    }
  }

  const wiki_chunk_ids: string[] = [];
  const lore_merges: LoreMergeRecord[] = [];
  const ingestProvenance = provenanceForIngestSlot(manuscriptId, slot, filename);

  if (normalized.length > 0) {
    try {
      for (const entry of normalized) {
        const gate = await writeWikiEntryWithMergeGate(supabase, {
          tenantId,
          manuscriptId,
          entry,
          provenance: ingestProvenance,
          sourcePrefix: "file-import-wiki",
          extraMeta: {
            ingest_slot: slot,
            file_import: true,
            ledger: "wiki_snapshot",
            wiki_visibility: "draft",
            lore_extraction: true,
          },
        });
        if (gate.kind === "merge_opened") {
          lore_merges.push(gate.merge);
        } else if (gate.result.id) {
          wiki_chunk_ids.push(gate.result.id);
          if (gate.result.action === "inserted") {
            convergence.lore = addConvergenceStats(convergence.lore, {
              inserted: 1,
              updated: 0,
              skipped: 0,
              skipped_user_override: 0,
            });
          } else if (gate.result.action === "updated") {
            convergence.lore = addConvergenceStats(convergence.lore, {
              inserted: 0,
              updated: 1,
              skipped: 0,
              skipped_user_override: 0,
            });
          } else {
            convergence.lore = addConvergenceStats(convergence.lore, {
              inserted: 0,
              updated: 0,
              skipped: 1,
              skipped_user_override: gate.result.userOverride ? 1 : 0,
            });
          }
        }
      }
    } catch (wikiErr) {
      const msg = wikiErr instanceof Error ? wikiErr.message : String(wikiErr);
      throw new Error(`Document ingest failed: wiki upsert — ${msg}`);
    }
    if (wiki_chunk_ids.length === 0 && lore_merges.length === 0) {
      throw new Error(
        `Document ingest failed: ${normalized.length} proposed wiki rows produced 0 persisted entries`
      );
    }
  } else if (slot !== "current_draft") {
    throw new Error(
      "Document ingest failed: no grounded wiki rows to commit (scan dropped all excerpts — check parse / structure)"
    );
  }

  let msgf_ingest: unknown = null;
  if (params.syncMsgfBrain !== false && sourceText.length > 500) {
    try {
      const sweepFiles = buildAuthorDocumentSweepFiles({
        manuscriptId,
        slot,
        sourceText,
        proposed: normalized,
        outlineBeats: beats,
      });
      if (sweepFiles.length) {
        msgf_ingest = await pipeToMsgfIngestService(sweepFiles, tenantId);
      }
    } catch (e) {
      console.warn("[commitDocumentIngest] msgf sweep ingest", e);
    }
  }

  const planning: PlanningIngestSnapshot = {
    manuscript_outline: outlineText,
    plot_beats: beats.map((b) => ({
      synopsis: b.synopsis,
      order: b.order,
      title: b.title,
      pov_mode: b.pov_mode,
      pov_names: b.pov_names,
      chapter_number: b.chapter_number ?? null,
    })),
    scene_card_count: beats.length,
    wiki_entry_count: wiki_chunk_ids.length,
    compile_stats: compiled.stats,
    convergence,
    lore_merges_opened: lore_merges.length,
    lore_merge_ids: lore_merges.map((m) => m.id),
  };

  return { lore_ingest, plot_ingest, wiki_chunk_ids, msgf_ingest, planning, lore_merges };
}
