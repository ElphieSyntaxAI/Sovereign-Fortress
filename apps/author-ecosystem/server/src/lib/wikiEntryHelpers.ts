import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createOpenAIEmbedder } from "./narrative/IngestionService.js";

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

export async function embedWikiExcerpt(excerpt: string): Promise<number[]> {
  const embedBatch = createOpenAIEmbedder();
  const [embedding] = await embedBatch([excerpt]);
  if (!embedding || embedding.length !== 1536) {
    throw new Error(`Embedding dimension mismatch: expected 1536, got ${embedding?.length ?? 0}`);
  }
  return embedding;
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
