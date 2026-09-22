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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Ingest district curriculum text into P6 `pillar_vectors` as sharded blocks (education RAG corpus).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai-utils";
import { buildCurriculumShardMetadata } from "@/lib/education/curriculum-metadata";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import {
  buildEducationChunkTopology,
  buildStructuralMacroWindows,
  buildDocumentCompilerStructuralSignals,
  type DocumentIngestCompilerState,
} from "@/lib/services/document-compiler";

const DEFAULT_CHUNK_CHARS = 1200;

export type CurriculumChunkSpan = {
  content: string;
  char_start: number;
  char_end: number;
};

export function chunkCurriculumText(
  text: string,
  maxChars = DEFAULT_CHUNK_CHARS
): string[] {
  return chunkCurriculumTextWithSpans(text, maxChars).map((c) => c.content);
}

export function chunkCurriculumTextWithSpans(
  text: string,
  maxChars = DEFAULT_CHUNK_CHARS,
  compilerState?: DocumentIngestCompilerState | null
): CurriculumChunkSpan[] {
  if (compilerState?.macro_windows?.length) {
    const spans: CurriculumChunkSpan[] = [];
    for (const window of compilerState.macro_windows) {
      const body = window.text.trim();
      if (!body) continue;
      if (body.length <= maxChars) {
        spans.push({ content: body, char_start: window.char_start, char_end: window.char_end });
        continue;
      }
      for (let i = 0; i < body.length; i += maxChars) {
        const slice = body.slice(i, i + maxChars);
        spans.push({
          content: slice,
          char_start: window.char_start + i,
          char_end: window.char_start + i + slice.length,
        });
      }
    }
    if (spans.length) return spans;
  }

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: CurriculumChunkSpan[] = [];
  let bucket = "";
  let bucketStart = 0;
  let cursor = 0;

  const flush = () => {
    const trimmed = bucket.trim();
    if (!trimmed) return;
    chunks.push({
      content: trimmed,
      char_start: bucketStart,
      char_end: bucketStart + trimmed.length,
    });
    bucket = "";
  };

  for (const para of paragraphs) {
    const piece = para.trim();
    if (!piece) continue;
    const pos = normalized.indexOf(piece, cursor);
    if (pos >= 0) cursor = pos + piece.length;
    if (!bucket) bucketStart = pos >= 0 ? pos : cursor;
    if (bucket.length + piece.length + 2 <= maxChars) {
      bucket = bucket ? `${bucket}\n\n${piece}` : piece;
    } else {
      flush();
      if (piece.length <= maxChars) {
        bucket = piece;
        bucketStart = pos >= 0 ? pos : cursor;
      } else {
        for (let i = 0; i < piece.length; i += maxChars) {
          const slice = piece.slice(i, i + maxChars);
          chunks.push({
            content: slice,
            char_start: (pos >= 0 ? pos : cursor) + i,
            char_end: (pos >= 0 ? pos : cursor) + i + slice.length,
          });
        }
        bucket = "";
      }
    }
  }
  flush();
  return chunks;
}

export async function ingestCurriculumDocument(params: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceDocument: string;
  fullText: string;
  bugIndex: GenealogicalBugIndex;
  subjectDomain?: "ela" | "history" | "math" | "science" | "general";
  assignmentId?: string;
  compilerState?: DocumentIngestCompilerState | null;
}): Promise<{ ingested: number; errors: string[] }> {
  return ingestCurriculumDocumentWithCompiler(params);
}

export async function ingestCurriculumDocumentWithCompiler(params: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceDocument: string;
  fullText: string;
  bugIndex: GenealogicalBugIndex;
  subjectDomain?: "ela" | "history" | "math" | "science" | "general";
  assignmentId?: string;
  compilerState?: DocumentIngestCompilerState | null;
}): Promise<{ ingested: number; errors: string[] }> {
  const compilerState =
    params.compilerState ??
    (params.fullText.trim()
      ? {
          version: "3-pass-v1" as const,
          domain_profile: "education_curriculum" as const,
          macro_windows: buildStructuralMacroWindows(
            params.fullText,
            buildDocumentCompilerStructuralSignals(params.fullText)
          ),
          entities: [],
          plot_beats: [],
          window_metacognition: [],
          passes_completed: [] as Array<"pass1" | "pass2" | "pass3">,
        }
      : null);

  const chunkSpans = chunkCurriculumTextWithSpans(
    params.fullText,
    DEFAULT_CHUNK_CHARS,
    compilerState
  );
  const errors: string[] = [];
  let ingested = 0;

  for (let i = 0; i < chunkSpans.length; i++) {
    const { content, char_start, char_end } = chunkSpans[i]!;
    const topology = buildEducationChunkTopology(char_start, char_end, compilerState);
    const metadata = buildCurriculumShardMetadata({
      bugIndex: params.bugIndex,
      sourceDocument: params.sourceDocument,
      shardIndex: i,
      subjectDomain: params.subjectDomain,
      assignmentId: params.assignmentId,
      scope: { tenantId: params.tenantId },
    });

    const enrichedMetadata = topology
      ? { ...metadata, compiler_topology: topology }
      : metadata;

    const embedding = await generateEmbedding(content);
    const { error } = await fromPillarVectors(params.supabase, params.tenantId).insert({
      content,
      metadata: enrichedMetadata,
      embedding,
    });

    if (error) {
      errors.push(`shard ${i}: ${error.message}`);
    } else {
      ingested += 1;
    }
  }

  return { ingested, errors };
}
