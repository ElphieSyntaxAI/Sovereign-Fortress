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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
/**
 * Ingest district curriculum text into P6 `pillar_vectors` as sharded blocks (education RAG corpus).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai-utils";
import { buildCurriculumShardMetadata } from "@/lib/education/curriculum-metadata";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

const DEFAULT_CHUNK_CHARS = 1200;

export function chunkCurriculumText(
  text: string,
  maxChars = DEFAULT_CHUNK_CHARS
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let bucket = "";

  for (const para of paragraphs) {
    const piece = para.trim();
    if (!piece) continue;
    if (bucket.length + piece.length + 2 <= maxChars) {
      bucket = bucket ? `${bucket}\n\n${piece}` : piece;
    } else {
      if (bucket) chunks.push(bucket);
      if (piece.length <= maxChars) {
        bucket = piece;
      } else {
        for (let i = 0; i < piece.length; i += maxChars) {
          chunks.push(piece.slice(i, i + maxChars));
        }
        bucket = "";
      }
    }
  }
  if (bucket) chunks.push(bucket);
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
}): Promise<{ ingested: number; errors: string[] }> {
  const chunks = chunkCurriculumText(params.fullText);
  const errors: string[] = [];
  let ingested = 0;

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const metadata = buildCurriculumShardMetadata({
      bugIndex: params.bugIndex,
      sourceDocument: params.sourceDocument,
      shardIndex: i,
      subjectDomain: params.subjectDomain,
      assignmentId: params.assignmentId,
      scope: { tenantId: params.tenantId },
    });

    const embedding = await generateEmbedding(content);
    const { error } = await fromPillarVectors(params.supabase, params.tenantId).insert({
      content,
      metadata,
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
