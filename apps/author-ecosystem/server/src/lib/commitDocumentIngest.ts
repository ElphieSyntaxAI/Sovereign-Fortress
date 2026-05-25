import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  slotDefaultMetadata,
  type DocumentIngestSlot,
  type IngestOutlineBeat,
  type ProposedWikiEntry,
} from "./documentIngestGate.js";
import {
  buildManuscriptOutlineFromBeats,
  normalizeProposedWikiEntry,
} from "./documentIngestOutline.js";
import { IngestionService } from "./narrative/IngestionService.js";
import { embedWikiExcerpt, newWikiSourceDocument } from "./wikiEntryHelpers.js";
import { pipeToMsgfIngestService } from "./fetchManuscript.js";

export type PlanningIngestSnapshot = {
  manuscript_outline: string;
  plot_beats: Array<{ synopsis: string; order: number }>;
  scene_card_count: number;
  wiki_entry_count: number;
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
  const { supabase, tenantId, manuscriptId, slot, filename, sourceText } = params;
  const normalized = params.proposed.map((e) =>
    normalizeProposedWikiEntry(e, manuscriptId, slot)
  );
  const beats =
    params.outlineBeats.length > 0
      ? params.outlineBeats
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
        ...slotDefaultMetadata(slot, manuscriptId),
        file_import: true,
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
        const embedding = await embedWikiExcerpt(excerpt);
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
            plot_point_order: b.plot_point_order ?? i + 1,
            ingest_slot: slot,
            file_import: true,
            ledger: "wiki_snapshot",
            wiki_visibility: "draft",
            outline_entity_kind: "plot_point",
          },
        });
      } catch {
        /* optional per-beat plot row */
      }
    }
  }

  const wiki_chunk_ids: string[] = [];
  for (const entry of normalized) {
    const excerpt = entry.excerpt.trim();
    if (excerpt.length < 20) continue;
    const embedding = await embedWikiExcerpt(excerpt);
    const source_document = newWikiSourceDocument(manuscriptId);
    const meta = {
      ...entry.wiki_metadata,
      proposed_chunk_title: entry.title,
      lore_extraction: true,
      wiki_author_entry: true,
      ingest_slot: slot,
      file_import: true,
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
    if (!error && data?.id) wiki_chunk_ids.push(String(data.id));
  }

  let msgf_ingest: unknown = null;
  if (params.syncMsgfBrain !== false && sourceText.length > 500) {
    try {
      const digest = createHash("sha256").update(sourceText, "utf8").digest("hex").slice(0, 16);
      msgf_ingest = await pipeToMsgfIngestService(
        [
          {
            path: `author-file-import/${slot}/${manuscriptId}-${digest}.txt`,
            content: sourceText.slice(0, 120000),
          },
        ],
        tenantId
      );
    } catch (e) {
      console.warn("[commitDocumentIngest] msgf ingest", e);
    }
  }

  const planning: PlanningIngestSnapshot = {
    manuscript_outline: outlineText,
    plot_beats: beats.map((b) => ({ synopsis: b.synopsis, order: b.order })),
    scene_card_count: beats.length,
    wiki_entry_count: wiki_chunk_ids.length,
  };

  return { lore_ingest, plot_ingest, wiki_chunk_ids, msgf_ingest, planning };
}
