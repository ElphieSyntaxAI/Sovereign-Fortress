import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

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
};

export type IngestManuscriptResult = {
  chunksTotal: number;
  chunksInserted: number;
  ids: string[];
};

const CHUNK_WORDS = 500;
const OVERLAP_WORDS = 50;
const EMBEDDING_DIM = 1536;
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

export type EmbedBatchFn = (texts: string[]) => Promise<number[][]>;

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

/**
 * OpenAI embeddings (1536-dim). Set `OPENAI_API_KEY`. Optional `OPENAI_EMBEDDING_MODEL` (default text-embedding-3-small).
 */
export function createOpenAIEmbedder(model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBED_MODEL): EmbedBatchFn {
  return async (texts: string[]) => {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      throw new Error("OPENAI_API_KEY is required to embed narrative chunks");
    }
    if (texts.length === 0) return [];

    const batchSize = 48;
    const all: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += batchSize) {
      const batch = texts.slice(offset, offset + batchSize);
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: batch }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI embeddings failed (${res.status}): ${errBody.slice(0, 500)}`);
      }

      const json = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };
      const sorted = [...json.data].sort((a, b) => a.index - b.index);
      for (const row of sorted) {
        if (!row.embedding || row.embedding.length !== EMBEDDING_DIM) {
          throw new Error(
            `Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${row.embedding?.length ?? 0} (model ${model})`
          );
        }
        all.push(row.embedding);
      }
    }

    return all;
  };
}

export class IngestionService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly embedBatch: EmbedBatchFn = createOpenAIEmbedder()
  ) {}

  /**
   * Parse → chunk (500 words / 50 overlap) → embed → replace prior rows for this source → insert into `p4_narrative_library_chunks`.
   */
  async ingestManuscript(input: IngestManuscriptInput): Promise<IngestManuscriptResult> {
    const { tenantId, sourceDocument, chunkType, buffer, filename, metadata: extraMeta } = input;

    const plain = await parseManuscriptToText(buffer, filename);
    if (!plain) {
      throw new Error("No extractable text in manuscript (empty document)");
    }

    const chunks = chunkTextByWords(plain, CHUNK_WORDS, OVERLAP_WORDS);
    if (chunks.length === 0) {
      throw new Error("Chunking produced no segments");
    }

    const embeddings = await this.embedBatch(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error(`Embedding count ${embeddings.length} does not match chunk count ${chunks.length}`);
    }

    const { error: delError } = await this.supabase
      .from("p4_narrative_library_chunks")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("source_document", sourceDocument)
      .eq("chunk_type", chunkType);

    if (delError) {
      throw new Error(`Failed to clear prior chunks: ${delError.message}`);
    }

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
      chunk_index: i,
      content,
      word_count: content.split(/\s+/).filter(Boolean).length,
      embedding: embeddings[i]!,
      metadata: baseMeta,
    }));

    const { data, error } = await this.supabase.from("p4_narrative_library_chunks").insert(rows).select("id");

    if (error) {
      throw new Error(`p4_narrative_library_chunks insert failed: ${error.message}`);
    }

    const ids = (data ?? []).map((r) => (r as { id: string }).id);

    return {
      chunksTotal: chunks.length,
      chunksInserted: ids.length,
      ids,
    };
  }
}
