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
  buildManuscriptOutlineFromBeats,
  normalizeProposedWikiEntry,
  type IngestPlotBeat,
} from "./documentIngestOutline.js";
import { IngestionService } from "./narrative/IngestionService.js";
import { embedWikiExcerptForIngest, newWikiSourceDocument } from "./wikiEntryHelpers.js";
import { buildAuthorDocumentSweepFiles } from "./documentIngestMsgfSweep.js";
import { pipeToMsgfIngestService } from "./fetchManuscript.js";

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
}): Promise<{
  lore_ingest: { chunksTotal: number; chunksInserted: number } | null;
  plot_ingest: { chunksTotal: number; chunksInserted: number } | null;
  wiki_chunk_ids: string[];
  msgf_ingest: unknown;
  planning: PlanningIngestSnapshot;
}> {
  const { supabase, tenantId, manuscriptId, slot, filename } = params;
  const compiled = compileDocumentIngest({
    outlineBeats: params.outlineBeats as IngestPlotBeat[],
    proposedWiki: params.proposed,
    sourceText: params.sourceText,
  });
  const sourceText = compiled.source_text ?? params.sourceText;
  const normalized = compiled.proposed_wiki.map((e) =>
    normalizeProposedWikiEntry(e, manuscriptId, slot)
  );
  const beats =
    compiled.outline_beats.length > 0
      ? compiled.outline_beats
      : slot === "current_draft"
        ? []
        : [];

  const ingestion = new IngestionService(supabase);
  let lore_ingest: { chunksTotal: number; chunksInserted: number } | null = null;
  let plot_ingest: { chunksTotal: number; chunksInserted: number } | null = null;

  try {
    lore_ingest = await ingestion.ingestManuscript({
      tenantId,
      sourceDocument: `file_import_${slot}/${manuscriptId}`,
      chunkType: "lore",
      buffer: Buffer.from(sourceText, "utf8"),
      filename,
      metadata: {
        manuscript_id: manuscriptId,
        ingest_slot: slot,
        file_import: true,
        rag_index: true,
        type: "lore",
        file_import_committed_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn("[commitDocumentIngest] lore vector", e);
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
        metadata: {
          outline: true,
          is_outline: true,
          manuscript_id: manuscriptId,
          file_import: true,
          rag_index: true,
          ingest_slot: slot,
        },
      });
    } catch (e) {
      console.warn("[commitDocumentIngest] plot vector", e);
    }

    for (let i = 0; i < beats.length; i++) {
      const b = beats[i]!;
      const excerpt = b.synopsis.trim();
      if (excerpt.length < 20) continue;
      try {
        const { embedding, embedding_degraded } = await embedWikiExcerptForIngest(excerpt);
        await supabase.from("p4_narrative_library_chunks").insert({
          tenant_id: tenantId,
          source_document: `file-import-scene/${manuscriptId}/${i}`,
          chunk_type: "plot",
          chunk_index: i,
          content: excerpt,
          word_count: excerpt.split(/\s+/).filter(Boolean).length,
          embedding,
          metadata: {
            outline: true,
            is_outline: true,
            manuscript_id: manuscriptId,
            scene_card: true,
            plot_point_order: b.plot_point_order ?? b.chapter_number ?? i + 1,
            chapter_number: b.chapter_number ?? null,
            beat_title: b.title,
            pov_mode: b.pov_mode,
            pov_names: b.pov_names,
            ingest_slot: slot,
            file_import: true,
            ledger: "wiki_snapshot",
            wiki_visibility: "draft",
            outline_entity_kind: "plot_point",
            ...(embedding_degraded ? { embedding_degraded: true } : {}),
          },
        });
      } catch (plotRowErr) {
        console.warn("[commitDocumentIngest] per-beat plot row", plotRowErr);
      }
    }
  }

  const wiki_chunk_ids: string[] = [];
  for (const entry of normalized) {
    const excerpt = entry.excerpt.trim();
    if (excerpt.length < 20) continue;
    let embedding: number[];
    let embedding_degraded = false;
    try {
      const emb = await embedWikiExcerptForIngest(excerpt);
      embedding = emb.embedding;
      embedding_degraded = emb.embedding_degraded;
    } catch (e) {
      console.warn("[commitDocumentIngest] wiki embed", e);
      continue;
    }
    const source_document = newWikiSourceDocument(manuscriptId);
    const meta = {
      ...entry.wiki_metadata,
      proposed_chunk_title: entry.title,
      lore_extraction: true,
      wiki_author_entry: true,
      ingest_slot: slot,
      file_import: true,
      ...(embedding_degraded ? { embedding_degraded: true } : {}),
    };
    const chunkType =
      entry.chunk_type === "plot" || entry.chunk_type === "event"
        ? "plot"
        : entry.chunk_type === "character"
          ? "lore"
          : "lore";
    const { data, error } = await supabase
      .from("p4_narrative_library_chunks")
      .insert({
        tenant_id: tenantId,
        source_document,
        chunk_type: chunkType,
        chunk_index: 0,
        content: excerpt,
        word_count: excerpt.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata: meta,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[commitDocumentIngest] wiki row insert", error.message, entry.title);
      continue;
    }
    if (data?.id) wiki_chunk_ids.push(String(data.id));
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
  };

  return { lore_ingest, plot_ingest, wiki_chunk_ids, msgf_ingest, planning };
}
