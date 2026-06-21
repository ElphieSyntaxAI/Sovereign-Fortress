import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  chunkMatchesManuscript,
  isDisplayableAuthorWikiChunk,
  isFileImportOutlineJunk,
  isScrappedWiki,
} from "../lib/wikiEntryHelpers.js";

export const wikiController = Router();

type WikiChunk = {
  id: string;
  chunk_type: string;
  source_document: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  visibility: "author" | "fan";
};

const SPOILER_RANK: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function spoilerRank(meta: Record<string, unknown>): number {
  const raw = String(meta.spoiler_level ?? meta["Spoiler Level"] ?? "high").toLowerCase();
  return SPOILER_RANK[raw] ?? 3;
}

function isWikiSnapshot(meta: Record<string, unknown>): boolean {
  return String(meta.ledger ?? "") === "wiki_snapshot";
}

function isFanVisibleWiki(meta: Record<string, unknown>): boolean {
  if (!isWikiSnapshot(meta)) return true;
  const locked = meta.wiki_hard_locked;
  if (locked === true || locked === "true" || locked === "1" || locked === "yes") return true;
  return String(meta.wiki_visibility ?? "") === "canon";
}

function filterForFanPreview(chunks: WikiChunk[]): WikiChunk[] {
  return chunks.filter((c) => {
    const meta = c.metadata;
    if (isWikiSnapshot(meta) && !isFanVisibleWiki(meta)) return false;
    if (spoilerRank(meta) > 1) return false;
    return true;
  });
}

/**
 * GET /api/wiki/:manuscriptId/chunks?view=author|fan_preview
 * Full author lore index vs fan-safe preview (no spoilers / no drafts).
 */
wikiController.get("/api/wiki/:manuscriptId/chunks", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  const view = String(req.query.view ?? "author").trim().toLowerCase();
  const fanPreview = view === "fan_preview" || view === "fan";

  const supabase = getSupabaseAdmin();
  const { data: ms } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, title, outline")
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (!ms) return res.status(404).json({ error: "Manuscript not found" });

  const { data: rows, error } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, chunk_type, source_document, chunk_index, content, metadata")
    .eq("tenant_id", user.userId)
    .eq("is_deleted", false)
    .in("chunk_type", ["lore", "plot", "character"])
    .order("source_document", { ascending: true })
    .order("chunk_index", { ascending: true })
    .limit(400);

  if (error) {
    console.error("[wiki/chunks]", error.message);
    return res.status(500).json({ error: error.message });
  }

  let hiddenRagShards = 0;
  let importCleanupCandidates = 0;
  const scoped = (rows ?? []).filter((r) => {
    const meta = (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<
      string,
      unknown
    >;
    if (isScrappedWiki(meta)) return false;
    if (!chunkMatchesManuscript(meta, manuscriptId)) return false;
    if (isFileImportOutlineJunk(meta)) importCleanupCandidates += 1;
    if (!isDisplayableAuthorWikiChunk(meta)) {
      hiddenRagShards += 1;
      return false;
    }
    return true;
  });

  const chunks: WikiChunk[] = scoped.map((r) => {
    const meta = (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<
      string,
      unknown
    >;
    const fanOk = !isWikiSnapshot(meta) || isFanVisibleWiki(meta);
    return {
      id: String(r.id),
      chunk_type: String(r.chunk_type),
      source_document: String(r.source_document ?? ""),
      chunk_index: Number(r.chunk_index ?? 0),
      content: String(r.content ?? ""),
      metadata: meta,
      visibility: fanOk ? "fan" : "author",
    };
  });

  const filtered = fanPreview ? filterForFanPreview(chunks) : chunks;

  return res.status(200).json({
    view: fanPreview ? "fan_preview" : "author",
    manuscript: { id: ms.id, title: ms.title, outline: ms.outline ?? null },
    chunks: filtered,
    stats: {
      total: chunks.length,
      shown: filtered.length,
      hidden_spoilers: fanPreview ? chunks.length - filtered.length : 0,
      hidden_rag_shards: hiddenRagShards,
      import_cleanup_candidates: importCleanupCandidates,
    },
  });
});
