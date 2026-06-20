import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkMatchesManuscript, isScrappedWiki } from "./wikiEntryHelpers.js";

export type ChunkCompositeKey = {
  source_document: string;
  chunk_type: "lore" | "plot" | "character";
  chunk_index: number;
};

export type ChunkRow = {
  id: string;
  source_document: string;
  chunk_type: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  is_deleted?: boolean;
};

export function isUserOverrideChunk(meta: Record<string, unknown>): boolean {
  return meta.user_override === true || meta.user_override === "true";
}

export function isChunkActive(row: {
  is_deleted?: boolean | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (row.is_deleted === true) return false;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  if (isScrappedWiki(meta)) return false;
  return true;
}

export function mergeChunkMetadata(
  prev: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...prev, ...patch };
}

export function markUserOverride(
  meta: Record<string, unknown>,
  actorId?: string
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    ...meta,
    user_override: true,
    user_override_at: now,
    ...(actorId ? { user_override_by: actorId } : {}),
  };
}

/** Assign sequential indices skipping author-preserved chunk_index slots. */
export function allocateChunkIndices(count: number, occupied: Iterable<number>): number[] {
  const taken = new Set(occupied);
  const indices: number[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    while (taken.has(cursor)) cursor += 1;
    indices.push(cursor);
    taken.add(cursor);
    cursor += 1;
  }
  return indices;
}

export function entityFingerprintFromMeta(meta: Record<string, unknown>): string | null {
  const fp = String(meta.entity_fingerprint ?? "").trim();
  return fp || null;
}

export async function assertChunkOwned(
  supabase: SupabaseClient,
  tenantId: string,
  keys: ChunkCompositeKey & { chunkId?: string }
): Promise<ChunkRow | null> {
  if (keys.chunkId) {
    const { data } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, source_document, chunk_type, chunk_index, content, metadata, is_deleted")
      .eq("id", keys.chunkId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return null;
    return normalizeChunkRow(data);
  }

  const { data } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, source_document, chunk_type, chunk_index, content, metadata, is_deleted")
    .eq("tenant_id", tenantId)
    .eq("source_document", keys.source_document)
    .eq("chunk_type", keys.chunk_type)
    .eq("chunk_index", keys.chunk_index)
    .maybeSingle();

  if (!data) return null;
  return normalizeChunkRow(data);
}

function normalizeChunkRow(row: Record<string, unknown>): ChunkRow {
  return {
    id: String(row.id),
    source_document: String(row.source_document ?? ""),
    chunk_type: String(row.chunk_type ?? ""),
    chunk_index: Number(row.chunk_index ?? 0),
    content: String(row.content ?? ""),
    metadata: (row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {}) as Record<string, unknown>,
    is_deleted: row.is_deleted === true,
  };
}

export type ManuscriptChunkLayout = {
  lore: { active_count: number; deleted_fingerprints: string[] };
  plot: { active_count: number; deleted_fingerprints: string[] };
  skipped_user_override: number;
};

export async function loadManuscriptChunkLayout(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string
): Promise<ManuscriptChunkLayout> {
  const { data: rows } = await supabase
    .from("p4_narrative_library_chunks")
    .select("chunk_type, metadata, is_deleted")
    .eq("tenant_id", tenantId)
    .in("chunk_type", ["lore", "plot", "character"])
    .limit(2000);

  const layout: ManuscriptChunkLayout = {
    lore: { active_count: 0, deleted_fingerprints: [] },
    plot: { active_count: 0, deleted_fingerprints: [] },
    skipped_user_override: 0,
  };

  for (const row of rows ?? []) {
    const meta = (row.metadata && typeof row.metadata === "object"
      ? row.metadata
      : {}) as Record<string, unknown>;
    if (!chunkMatchesManuscript(meta, manuscriptId)) continue;

    const fp = entityFingerprintFromMeta(meta);
    const chunkType = String((row as { chunk_type?: string }).chunk_type ?? "lore");
    const bucket = chunkType === "plot" ? layout.plot : layout.lore;
    const deleted = (row as { is_deleted?: boolean }).is_deleted === true;

    if (deleted) {
      if (fp) bucket.deleted_fingerprints.push(fp);
      continue;
    }

    if (isUserOverrideChunk(meta)) {
      layout.skipped_user_override += 1;
    }

    if (fp || meta.wiki_author_entry === true || meta.lore_extraction === true) {
      bucket.active_count += 1;
    }
  }

  layout.lore.deleted_fingerprints = [...new Set(layout.lore.deleted_fingerprints)];
  layout.plot.deleted_fingerprints = [...new Set(layout.plot.deleted_fingerprints)];
  return layout;
}
