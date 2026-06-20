import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  isBulkRagShard,
  isProtectedCuratedEntry,
  isRagExcluded,
} from "../lib/narrative/narrativeChunkVisibility.js";
import { chunkMatchesManuscript } from "../lib/wikiEntryHelpers.js";

export const narrativeChunksController = Router();

type ChunkRow = {
  id: string;
  chunk_type: string;
  source_document: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
};

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

async function resolveChunk(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  params: {
    chunkId?: string;
    source_document?: string;
    chunk_type?: string;
    chunk_index?: number;
  }
): Promise<ChunkRow | null> {
  if (params.chunkId) {
    const { data } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, chunk_type, source_document, chunk_index, content, metadata")
      .eq("id", params.chunkId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id),
      chunk_type: String(data.chunk_type),
      source_document: String(data.source_document ?? ""),
      chunk_index: Number(data.chunk_index ?? 0),
      content: String(data.content ?? ""),
      metadata: (data.metadata && typeof data.metadata === "object"
        ? data.metadata
        : {}) as Record<string, unknown>,
    };
  }

  const source = String(params.source_document ?? "").trim();
  const chunkType = String(params.chunk_type ?? "").trim();
  const chunkIndex = Number(params.chunk_index);
  if (!source || !chunkType || !Number.isFinite(chunkIndex)) return null;

  const { data } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, chunk_type, source_document, chunk_index, content, metadata")
    .eq("tenant_id", tenantId)
    .eq("source_document", source)
    .eq("chunk_type", chunkType)
    .eq("chunk_index", chunkIndex)
    .maybeSingle();

  if (!data) return null;
  return {
    id: String(data.id),
    chunk_type: String(data.chunk_type),
    source_document: String(data.source_document ?? ""),
    chunk_index: Number(data.chunk_index ?? 0),
    content: String(data.content ?? ""),
    metadata: (data.metadata && typeof data.metadata === "object"
      ? data.metadata
      : {}) as Record<string, unknown>,
  };
}

async function logChunkFeedback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    tenantId: string;
    actorId: string;
    manuscriptId: string;
    chunkId: string;
    action: string;
    reason?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("p4_narrative_logs").insert({
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    action_type: "rag_chunk_feedback",
    message: `RAG chunk ${params.action}: ${params.chunkId}`.slice(0, 500),
    metadata: {
      proof_type: "rag_chunk_feedback",
      manuscript_id: params.manuscriptId,
      chunk_id: params.chunkId,
      reason: params.reason ?? null,
    },
    severity: "Info",
  });
  if (error) console.warn("[narrativeChunks/feedback-log]", error.message);
}

/**
 * GET /api/manuscripts/:manuscriptId/chunks/rag-shards
 * List bulk RAG shards for author review (optional source_document prefix filter).
 */
narrativeChunksController.get(
  "/api/manuscripts/:manuscriptId/chunks/rag-shards",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const sourcePrefix = String(req.query.source_document_prefix ?? "").trim();
    const supabase = getSupabaseAdmin();

    if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    const { data: rows, error } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, chunk_type, source_document, chunk_index, content, metadata, word_count")
      .eq("tenant_id", user.userId)
      .eq("is_deleted", false)
      .order("source_document", { ascending: true })
      .order("chunk_index", { ascending: true })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });

    const shards = (rows ?? [])
      .map((r) => {
        const meta = (r.metadata && typeof r.metadata === "object"
          ? r.metadata
          : {}) as Record<string, unknown>;
        return {
          id: String(r.id),
          chunk_type: String(r.chunk_type),
          source_document: String(r.source_document ?? ""),
          chunk_index: Number(r.chunk_index ?? 0),
          word_count: Number((r as { word_count?: number }).word_count ?? 0),
          content_preview: String(r.content ?? "").slice(0, 240),
          metadata: meta,
          excluded: isRagExcluded(meta),
        };
      })
      .filter((s) => chunkMatchesManuscript(s.metadata, manuscriptId))
      .filter((s) => isBulkRagShard(s.metadata))
      .filter((s) => !sourcePrefix || s.source_document.startsWith(sourcePrefix));

    return res.status(200).json({ manuscript_id: manuscriptId, shards, count: shards.length });
  }
);

/**
 * POST /api/manuscripts/:manuscriptId/chunks/:chunkId/report
 * Soft-exclude a bulk RAG shard from vector retrieval.
 */
narrativeChunksController.post(
  "/api/manuscripts/:manuscriptId/chunks/:chunkId/report",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const chunkId = String(req.params.chunkId ?? "").trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = String(body.reason ?? "merged_topics").trim().slice(0, 64);
    const notes = String(body.notes ?? "").trim().slice(0, 500);
    const force = body.force === true;

    const supabase = getSupabaseAdmin();
    if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    let chunk = await resolveChunk(supabase, user.userId, {
      chunkId,
      source_document: body.source_document != null ? String(body.source_document) : undefined,
      chunk_type: body.chunk_type != null ? String(body.chunk_type) : undefined,
      chunk_index: body.chunk_index != null ? Number(body.chunk_index) : undefined,
    });

    if (!chunk) return res.status(404).json({ error: "Chunk not found" });

    if (!chunkMatchesManuscript(chunk.metadata, manuscriptId)) {
      return res.status(403).json({ error: "Chunk does not belong to this manuscript" });
    }

    if (isProtectedCuratedEntry(chunk.metadata) && !force) {
      return res.status(409).json({
        error: "Curated wiki entry — use wiki scrap flow instead of RAG report.",
        code: "CURATED_ENTRY",
      });
    }

    if (!isBulkRagShard(chunk.metadata) && !force) {
      return res.status(409).json({
        error: "Only bulk RAG shards can be reported via this endpoint.",
        code: "NOT_BULK_SHARD",
      });
    }

    const now = new Date().toISOString();
    const nextMeta = {
      ...chunk.metadata,
      rag_excluded_at: now,
      chunk_feedback: {
        reported: true,
        reason,
        notes: notes || undefined,
        reporter_id: user.userId,
        reported_at: now,
      },
    };

    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({ metadata: nextMeta, is_deleted: true })
      .eq("id", chunk.id)
      .eq("tenant_id", user.userId);

    if (error) return res.status(500).json({ error: error.message });

    await logChunkFeedback(supabase, {
      tenantId: user.userId,
      actorId: user.userId,
      manuscriptId,
      chunkId: chunk.id,
      action: "report",
      reason,
    });

    return res.status(200).json({ success: true, chunk_id: chunk.id, rag_excluded_at: now });
  }
);

/**
 * POST /api/manuscripts/:manuscriptId/chunks/:chunkId/restore
 * Clear soft-exclusion on a previously reported bulk shard.
 */
narrativeChunksController.post(
  "/api/manuscripts/:manuscriptId/chunks/:chunkId/restore",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const chunkId = String(req.params.chunkId ?? "").trim();
    const supabase = getSupabaseAdmin();

    if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }

    const chunk = await resolveChunk(supabase, user.userId, { chunkId });
    if (!chunk) return res.status(404).json({ error: "Chunk not found" });

    if (!chunkMatchesManuscript(chunk.metadata, manuscriptId)) {
      return res.status(403).json({ error: "Chunk does not belong to this manuscript" });
    }

    const { rag_excluded_at: _e, chunk_feedback: _f, ...rest } = chunk.metadata;
    const nextMeta = { ...rest, rag_restored_at: new Date().toISOString() };

    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({ metadata: nextMeta, is_deleted: false })
      .eq("id", chunk.id)
      .eq("tenant_id", user.userId);

    if (error) return res.status(500).json({ error: error.message });

    await logChunkFeedback(supabase, {
      tenantId: user.userId,
      actorId: user.userId,
      manuscriptId,
      chunkId: chunk.id,
      action: "restore",
    });

    return res.status(200).json({ success: true, chunk_id: chunk.id });
  }
);
