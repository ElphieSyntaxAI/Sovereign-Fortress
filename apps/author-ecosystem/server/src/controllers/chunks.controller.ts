import { Router, type Request, type Response } from "express";

import {
  assertChunkOwned,
  isChunkActive,
  markUserOverride,
  mergeChunkMetadata,
  type ChunkCompositeKey,
} from "../lib/chunkLifecycle.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  chunkMatchesManuscript,
  embedWikiExcerpt,
  isScrappedWiki,
} from "../lib/wikiEntryHelpers.js";

export const chunksController = Router();

const MIN_CONTENT = 20;

async function assertManuscriptOwned(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  manuscriptId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("id", manuscriptId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

function parseCompositeKey(body: Record<string, unknown>): ChunkCompositeKey | null {
  const source_document = String(body.source_document ?? "").trim();
  const chunk_type = String(body.chunk_type ?? "").trim() as ChunkCompositeKey["chunk_type"];
  const chunk_index = Number(body.chunk_index);
  if (!source_document || !chunk_type || !Number.isFinite(chunk_index)) return null;
  if (!["lore", "plot", "character"].includes(chunk_type)) return null;
  return { source_document, chunk_type, chunk_index };
}

/**
 * PATCH /api/chunks/update — author edit with user_override lock.
 */
chunksController.patch("/api/chunks/update", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const key = parseCompositeKey(body);
  if (!key) {
    return res.status(400).json({ error: "source_document, chunk_type, and chunk_index are required" });
  }

  const updated_content = String(body.updated_content ?? "").trim();
  if (updated_content.length < MIN_CONTENT) {
    return res.status(400).json({ error: `updated_content must be at least ${MIN_CONTENT} characters` });
  }

  const manuscriptId = body.manuscript_id != null ? String(body.manuscript_id).trim() : "";
  const updated_metadata =
    body.updated_metadata != null &&
    typeof body.updated_metadata === "object" &&
    !Array.isArray(body.updated_metadata)
      ? (body.updated_metadata as Record<string, unknown>)
      : {};

  const supabase = getSupabaseAdmin();
  const chunk = await assertChunkOwned(supabase, user.userId, key);
  if (!chunk) return res.status(404).json({ error: "Chunk not found" });
  if (!isChunkActive(chunk)) return res.status(404).json({ error: "Chunk not found or inactive" });
  if (isScrappedWiki(chunk.metadata)) {
    return res.status(409).json({ error: "Chunk is scrapped — restore before editing" });
  }

  if (manuscriptId) {
    if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }
    if (!chunkMatchesManuscript(chunk.metadata, manuscriptId)) {
      return res.status(403).json({ error: "Chunk does not belong to this manuscript" });
    }
  }

  try {
    const embedding = await embedWikiExcerpt(updated_content);
    const metadata = markUserOverride(
      mergeChunkMetadata(chunk.metadata, {
        ...updated_metadata,
        embedding_degraded: undefined,
      }),
      user.userId
    );
    delete metadata.embedding_degraded;

    const { data: updated, error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({
        content: updated_content,
        word_count: updated_content.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata,
      })
      .eq("id", chunk.id)
      .eq("tenant_id", user.userId)
      .select("id, chunk_type, source_document, chunk_index, content, metadata, is_deleted")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, chunk: updated });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Update failed" });
  }
});

/**
 * POST /api/chunks/remove — soft delete (is_deleted + optional chunk_feedback).
 */
chunksController.post("/api/chunks/remove", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const key = parseCompositeKey(body);
  if (!key) {
    return res.status(400).json({ error: "source_document, chunk_type, and chunk_index are required" });
  }

  const reason = String(body.reason ?? "author_deleted").trim().slice(0, 64);
  const manuscriptId = body.manuscript_id != null ? String(body.manuscript_id).trim() : "";

  const supabase = getSupabaseAdmin();
  const chunk = await assertChunkOwned(supabase, user.userId, key);
  if (!chunk) return res.status(404).json({ error: "Chunk not found" });
  if (chunk.is_deleted) return res.status(404).json({ error: "Chunk already removed" });

  if (manuscriptId) {
    if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }
    if (!chunkMatchesManuscript(chunk.metadata, manuscriptId)) {
      return res.status(403).json({ error: "Chunk does not belong to this manuscript" });
    }
  }

  const now = new Date().toISOString();
  const isEntity =
    chunk.metadata.wiki_author_entry === true ||
    chunk.metadata.scene_card === true ||
    chunk.metadata.lore_extraction === true;

  let nextMeta = markUserOverride(chunk.metadata, user.userId);
  if (reason) {
    nextMeta = mergeChunkMetadata(nextMeta, {
      chunk_feedback: { reported: true, reason, reporter_id: user.userId, reported_at: now },
    });
  }
  if (isEntity) {
    nextMeta = mergeChunkMetadata(nextMeta, {
      wiki_scrapped_at: now,
      wiki_visibility: "draft",
      wiki_scrapped_reason: reason,
    });
  }

  const { error } = await supabase
    .from("p4_narrative_library_chunks")
    .update({ is_deleted: true, metadata: nextMeta })
    .eq("id", chunk.id)
    .eq("tenant_id", user.userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, chunk_id: chunk.id });
});

/**
 * POST /api/chunks/restore — clear is_deleted and scrap metadata on bulk/entity shards.
 */
chunksController.post("/api/chunks/restore", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const key = parseCompositeKey(body);
  if (!key) {
    return res.status(400).json({ error: "source_document, chunk_type, and chunk_index are required" });
  }

  const manuscriptId = body.manuscript_id != null ? String(body.manuscript_id).trim() : "";
  const supabase = getSupabaseAdmin();
  const chunk = await assertChunkOwned(supabase, user.userId, key);
  if (!chunk) return res.status(404).json({ error: "Chunk not found" });
  if (!chunk.is_deleted && !isScrappedWiki(chunk.metadata)) {
    return res.status(409).json({ error: "Chunk is not removed" });
  }

  if (manuscriptId) {
    if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }
    if (!chunkMatchesManuscript(chunk.metadata, manuscriptId)) {
      return res.status(403).json({ error: "Chunk does not belong to this manuscript" });
    }
  }

  const {
    wiki_scrapped_at: _s,
    wiki_scrapped_reason: _r,
    rag_excluded_at: _e,
    chunk_feedback: _f,
    ...rest
  } = chunk.metadata;
  const nextMeta = mergeChunkMetadata(rest, {
    chunk_restored_at: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("p4_narrative_library_chunks")
    .update({ is_deleted: false, metadata: nextMeta })
    .eq("id", chunk.id)
    .eq("tenant_id", user.userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true, chunk_id: chunk.id });
});
