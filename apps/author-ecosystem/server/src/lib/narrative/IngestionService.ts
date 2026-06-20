import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

import {
  createDefaultNarrativeEmbedder,
  NARRATIVE_EMBEDDING_DIM,
  type EmbedBatchFn,
} from "./narrativeEmbedder.js";
import {
  chunkTextSemantic,
  type SemanticBoundary,
  type SemanticRegion,
} from "./semanticChunking.js";
import {
  allocateChunkIndices,
  isUserOverrideChunk,
} from "../chunkLifecycle.js";

export type { EmbedBatchFn } from "./narrativeEmbedder.js";
export {
  createDefaultNarrativeEmbedder,
  createGeminiNarrativeEmbedder,
  createOpenAIEmbedder,
  narrativeEmbedderProvider,
} from "./narrativeEmbedder.js";

/** Semantic category for Librarian retrieval (manuscript vs bible lane). */
export type NarrativeChunkType = "lore" | "plot" | "character";

export type IngestManuscriptInput = {
  tenantId: string;
  /** Logical name or filename shown in metadata (e.g. "WorldBible.docx"). */
  sourceDocument: string;
  chunkType: NarrativeChunkType;
  buffer: Buffer;
  /** Original filename; used to pick docx vs pdf vs plain text. */
  filename: string;
  /** Extra JSON metadata stored per row (merged with defaults). */
  metadata?: Record<string, unknown>;
  /** Optional semantic boundary hints from CONVERGE / heuristics. */
  boundaryHints?: SemanticBoundary[];
  semanticRegions?: SemanticRegion[];
};

export type IngestManuscriptResult = {
  chunksTotal: number;
  chunksInserted: number;
  ids: string[];
  preserved_user_overrides?: number;
};

const CHUNK_WORDS = 500;
const OVERLAP_WORDS = 50;
const EMBEDDING_DIM = NARRATIVE_EMBEDDING_DIM;

function normalizeWhitespace(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

/**
 * Extract plain text from manuscript uploads (.docx, .pdf, .txt / fallback utf-8).
 */
export async function parseManuscriptToText(buffer: Buffer, filename: string): Promise<string> {
  const ext = extensionOf(filename);
  if (ext === "docx" || ext === "doc") {
    const { value } = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(value);
  }
  if (ext === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText();
      return normalizeWhitespace(text ?? "");
    } finally {
      await parser.destroy();
    }
  }
  return normalizeWhitespace(buffer.toString("utf8"));
}

/**
 * Split prose into fixed word windows with overlap so boundary context is preserved.
 */
export function chunkTextByWords(
  text: string,
  chunkWords: number = CHUNK_WORDS,
  overlapWords: number = OVERLAP_WORDS
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const step = Math.max(1, chunkWords - overlapWords);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + chunkWords);
    if (slice.length === 0) break;
    chunks.push(slice.join(" "));
    if (i + chunkWords >= words.length) break;
  }
  return chunks;
}

export class IngestionService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embedBatch: EmbedBatchFn = createDefaultNarrativeEmbedder()
  ) {}

  /**
   * Parse → chunk (500 words / 50 overlap) → embed → replace prior rows for this source → insert into `p4_narrative_library_chunks`.
   */
  async ingestManuscript(input: IngestManuscriptInput): Promise<IngestManuscriptResult> {
    const {
      tenantId,
      sourceDocument,
      chunkType,
      buffer,
      filename,
      metadata: extraMeta,
      boundaryHints,
      semanticRegions,
    } = input;

    const plain = await parseManuscriptToText(buffer, filename);
    if (!plain) {
      throw new Error("No extractable text in manuscript (empty document)");
    }

    const { chunks, shardMeta } = await chunkTextSemantic(plain, {
      boundaries: boundaryHints,
      semanticRegions,
      maxWords: CHUNK_WORDS,
      overlapWords: OVERLAP_WORDS,
      embedBatch: this.embedBatch,
    });
    if (chunks.length === 0) {
      throw new Error("Chunking produced no segments");
    }

    const embeddings = await this.embedBatch(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error(`Embedding count ${embeddings.length} does not match chunk count ${chunks.length}`);
    }

    const { data: existingRows, error: loadErr } = await this.supabase
      .from("p4_narrative_library_chunks")
      .select("id, chunk_index, metadata, is_deleted")
      .eq("tenant_id", tenantId)
      .eq("source_document", sourceDocument)
      .eq("chunk_type", chunkType);

    if (loadErr) {
      throw new Error(`Failed to load prior chunks: ${loadErr.message}`);
    }

    const preservedIds: string[] = [];
    const occupiedIndices = new Set<number>();
    for (const row of existingRows ?? []) {
      const r = row as { id?: string; chunk_index?: number; metadata?: unknown; is_deleted?: boolean };
      if (r.is_deleted === true) continue;
      const meta =
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : {};
      if (isUserOverrideChunk(meta)) {
        if (r.id) preservedIds.push(String(r.id));
        if (typeof r.chunk_index === "number") occupiedIndices.add(r.chunk_index);
        continue;
      }
      if (r.id) {
        const { error: delOneErr } = await this.supabase
          .from("p4_narrative_library_chunks")
          .delete()
          .eq("id", r.id)
          .eq("tenant_id", tenantId);
        if (delOneErr) {
          throw new Error(`Failed to clear replaceable chunk ${r.id}: ${delOneErr.message}`);
        }
      }
    }

    const assignedIndices = allocateChunkIndices(chunks.length, occupiedIndices);

    const baseMeta = {
      source_document: sourceDocument,
      type: chunkType,
      chunk_word_target: CHUNK_WORDS,
      overlap_words: OVERLAP_WORDS,
      original_filename: filename,
      ...(extraMeta && typeof extraMeta === "object" ? extraMeta : {}),
    };

    const rows = chunks.map((content, i) => ({
      tenant_id: tenantId,
      source_document: sourceDocument,
      chunk_type: chunkType,
      chunk_index: assignedIndices[i]!,
      content,
      word_count: content.split(/\s+/).filter(Boolean).length,
      embedding: embeddings[i]!,
      metadata: {
        ...baseMeta,
        ...(shardMeta[i]?.semantic_domain ? { semantic_domain: shardMeta[i]!.semantic_domain } : {}),
        ...(shardMeta[i]?.boundary_sources?.length
          ? { boundary_sources: shardMeta[i]!.boundary_sources }
          : {}),
        segment_index: shardMeta[i]?.segment_index ?? 0,
      },
      is_deleted: false,
    }));

    const { data, error } = await this.supabase.from("p4_narrative_library_chunks").insert(rows).select("id");

    if (error) {
      throw new Error(`p4_narrative_library_chunks insert failed: ${error.message}`);
    }

    const ids = (data ?? []).map((r) => (r as { id: string }).id);

    return {
      chunksTotal: chunks.length,
      chunksInserted: ids.length,
      ids: [...preservedIds, ...ids],
      preserved_user_overrides: preservedIds.length,
    };
  }
}
