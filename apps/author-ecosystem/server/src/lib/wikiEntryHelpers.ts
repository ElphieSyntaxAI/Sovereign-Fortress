import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createDefaultNarrativeEmbedder } from "./narrative/IngestionService.js";

export type HumanEffortPayload = {
  started_at?: string;
  last_edit_at?: string;
  title_chars?: number;
  body_chars?: number;
  edit_events?: Array<{ at: string; field: string; chars: number }>;
  client?: string;
};

export function chunkMatchesManuscript(meta: Record<string, unknown>, manuscriptId: string): boolean {
  if (String(meta.manuscript_id ?? "") === manuscriptId) return true;
  if (String(meta.project_id ?? "") === manuscriptId) return true;
  const src = String(meta.source_document ?? "");
  return src.includes(manuscriptId);
}

export function isScrappedWiki(meta: Record<string, unknown>): boolean {
  return Boolean(meta.wiki_scrapped_at);
}

/**
 * Lore encyclopedia rows (characters, settings, etc.) — not raw RAG retrieval shards.
 * File import also writes 500-word overlapping vectors for Librarian search; those must not
 * appear as wiki articles.
 */
export function isDisplayableAuthorWikiChunk(meta: Record<string, unknown>): boolean {
  if (isScrappedWiki(meta)) return false;

  if (meta.rag_index === true && meta.wiki_author_entry !== true) return false;

  if (
    meta.file_import === true &&
    meta.wiki_author_entry !== true &&
    !String(meta.proposed_chunk_title ?? "").trim()
  ) {
    return false;
  }

  if (meta.planning_session_sync === true) return false;

  if (meta.wiki_author_entry === true) return true;
  if (String(meta.proposed_chunk_title ?? "").trim()) return true;
  if (meta.lore_extraction === true) return true;
  if (meta.scene_card === true) return true;
  if (String(meta.ledger ?? "") === "wiki_snapshot" && meta.outline_entity_kind) return true;

  return false;
}

export function buildWikiSnapshotBody(params: {
  title: string;
  excerpt: string;
  chunk_type_raw: string;
  tags: string[];
}): string {
  const { title, excerpt, chunk_type_raw, tags } = params;
  return [
    "# Wiki entry (author)",
    `## ${title}`,
    `**chunk_type:** ${chunk_type_raw}`,
    `**tags:** ${tags.length ? tags.join(", ") : "(none)"}`,
    "",
    excerpt,
  ].join("\n");
}

export function toP4ChunkType(raw: string): "lore" | "plot" | "character" {
  const x = raw.toLowerCase();
  if (x === "plot" || x === "event" || x === "plot_point") return "plot";
  if (x === "character") return "character";
  return "lore";
}

const EMBEDDING_DIM = 1536;
const ZERO_EMBEDDING: number[] = Array.from({ length: EMBEDDING_DIM }, () => 0);

export async function embedWikiExcerpt(excerpt: string): Promise<number[]> {
  const embedBatch = createDefaultNarrativeEmbedder();
  const [embedding] = await embedBatch([excerpt]);
  if (!embedding || embedding.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${embedding?.length ?? 0}`);
  }
  return embedding;
}

/** Best-effort embed for ingest commit — never throws (uses zero vector if OPENAI unavailable). */
export async function embedWikiExcerptForIngest(excerpt: string): Promise<{
  embedding: number[];
  embedding_degraded: boolean;
}> {
  try {
    const embedding = await embedWikiExcerpt(excerpt);
    return { embedding, embedding_degraded: false };
  } catch (e) {
    console.warn("[wiki] embedWikiExcerptForIngest degraded", e);
    return { embedding: ZERO_EMBEDDING, embedding_degraded: true };
  }
}

export async function recordWikiHumanEffort(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    actorId: string;
    manuscriptId: string;
    action: string;
    title: string;
    chunkId?: string | null;
    outlineEntityKind?: string;
    humanEffort?: HumanEffortPayload | null;
  }
): Promise<void> {
  const meta: Record<string, unknown> = {
    proof_type: "wiki_author_human_effort",
    manuscript_id: params.manuscriptId,
    chunk_id: params.chunkId ?? null,
    outline_entity_kind: params.outlineEntityKind ?? null,
    human_effort: params.humanEffort ?? null,
  };
  const { error } = await supabase.from("p4_narrative_logs").insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    action_type: "wiki_author_effort",
    message: `Wiki ${params.action}: ${params.title}`.slice(0, 500),
    metadata: meta,
    severity: "Info",
  });
  if (error) {
    console.warn("[wiki/human-effort]", error.message);
  }
}

export function newWikiSourceDocument(manuscriptId: string, chunkId?: string): string {
  return `wiki-entry/${manuscriptId}/${chunkId ?? randomUUID()}`;
}
