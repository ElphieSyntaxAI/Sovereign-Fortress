import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  buildWikiSnapshotBody,
  chunkMatchesManuscript,
  embedWikiExcerpt,
  isScrappedWiki,
  newWikiSourceDocument,
  recordWikiHumanEffort,
  toP4ChunkType,
  type HumanEffortPayload,
} from "../lib/wikiEntryHelpers.js";
import { markUserOverride, mergeChunkMetadata } from "../lib/chunkLifecycle.js";

export const wikiEntriesController = Router();

const MIN_EXCERPT = 20;

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

function parseProposed(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const excerpt = String(body.excerpt ?? body.details ?? "").trim();
  const chunk_type_raw = String(body.chunk_type ?? "other").trim().toLowerCase() || "other";
  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
  }
  const wiki_metadata =
    body.wiki_metadata != null && typeof body.wiki_metadata === "object" && !Array.isArray(body.wiki_metadata)
      ? (body.wiki_metadata as Record<string, unknown>)
      : {};
  const human_effort =
    body.human_effort != null && typeof body.human_effort === "object" && !Array.isArray(body.human_effort)
      ? (body.human_effort as HumanEffortPayload)
      : null;
  const outline_entity_kind = String(wiki_metadata.outline_entity_kind ?? body.outline_entity_kind ?? "").trim();
  return { title, excerpt, chunk_type_raw, tags, wiki_metadata, human_effort, outline_entity_kind };
}

function buildMetadata(params: {
  manuscriptId: string;
  title: string;
  chunk_type_raw: string;
  tags: string[];
  wiki_metadata: Record<string, unknown>;
  committed: boolean;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    ledger: "wiki_snapshot",
    manuscript_id: params.manuscriptId,
    lore_extraction: true,
    lore_extraction_chunk_type: params.chunk_type_raw,
    lore_extraction_tags: params.tags,
    proposed_chunk_title: params.title,
    wiki_author_entry: true,
    wiki_visibility: params.committed ? "canon" : "draft",
    wiki_committed_at: params.committed ? now : null,
    ...params.wiki_metadata,
  };
}

/**
 * POST /api/wiki/:manuscriptId/entries — commit sheet to live wiki (DB + embedding).
 */
wikiEntriesController.post("/api/wiki/:manuscriptId/entries", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { title, excerpt, chunk_type_raw, tags, wiki_metadata, human_effort, outline_entity_kind } =
    parseProposed(body);

  if (!title) return res.status(400).json({ error: "title is required" });
  if (excerpt.length < MIN_EXCERPT) {
    return res.status(400).json({ error: `excerpt must be at least ${MIN_EXCERPT} characters` });
  }

  const supabase = getSupabaseAdmin();
  if (!(await assertManuscriptOwned(supabase, user.userId, manuscriptId))) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  try {
    const embedding = await embedWikiExcerpt(excerpt);
    const p4Type = toP4ChunkType(chunk_type_raw);
    const sourceDocument = newWikiSourceDocument(manuscriptId);
    const content = buildWikiSnapshotBody({ title, excerpt, chunk_type_raw, tags });
    const metadata = buildMetadata({
      manuscriptId,
      title,
      chunk_type_raw,
      tags,
      wiki_metadata,
      committed: true,
    });

    const { data: ins, error: insErr } = await supabase
      .from("p4_narrative_library_chunks")
      .insert({
        tenant_id: user.userId,
        source_document: sourceDocument,
        chunk_type: p4Type,
        chunk_index: 0,
        content,
        word_count: excerpt.split(/\s+/).filter(Boolean).length,
        embedding,
        metadata,
      })
      .select("id, chunk_type, source_document, chunk_index, content, metadata")
      .maybeSingle();

    if (insErr) return res.status(500).json({ error: insErr.message });

    const chunkId = String((ins as { id?: string }).id ?? "");
    await recordWikiHumanEffort(supabase, {
      tenantId: user.userId,
      actorId: user.userId,
      manuscriptId,
      action: "commit",
      title,
      chunkId,
      outlineEntityKind: outline_entity_kind || chunk_type_raw,
      humanEffort: human_effort,
    });

    return res.status(201).json({ success: true, chunk: ins });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Commit failed" });
  }
});

/**
 * PATCH /api/wiki/:manuscriptId/entries/:chunkId — update committed wiki row.
 */
wikiEntriesController.patch(
  "/api/wiki/:manuscriptId/entries/:chunkId",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const chunkId = String(req.params.chunkId ?? "").trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { title, excerpt, chunk_type_raw, tags, wiki_metadata, human_effort, outline_entity_kind } =
      parseProposed(body);

    if (!title) return res.status(400).json({ error: "title is required" });
    if (excerpt.length < MIN_EXCERPT) {
      return res.status(400).json({ error: `excerpt must be at least ${MIN_EXCERPT} characters` });
    }

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, metadata, source_document, is_deleted")
      .eq("id", chunkId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Wiki entry not found" });
    if ((existing as { is_deleted?: boolean }).is_deleted === true) {
      return res.status(404).json({ error: "Wiki entry not found" });
    }

    const prevMeta = (existing.metadata && typeof existing.metadata === "object"
      ? existing.metadata
      : {}) as Record<string, unknown>;
    if (!chunkMatchesManuscript(prevMeta, manuscriptId)) {
      return res.status(403).json({ error: "Entry does not belong to this manuscript" });
    }
    if (isScrappedWiki(prevMeta)) {
      return res.status(409).json({ error: "Entry is scrapped — restore before editing" });
    }

    try {
      const embedding = await embedWikiExcerpt(excerpt);
      const p4Type = toP4ChunkType(chunk_type_raw);
      const content = buildWikiSnapshotBody({ title, excerpt, chunk_type_raw, tags });
      const metadata = markUserOverride(
        mergeChunkMetadata(prevMeta, {
          ...buildMetadata({
            manuscriptId,
            title,
            chunk_type_raw,
            tags,
            wiki_metadata,
            committed: true,
          }),
          source_document: prevMeta.source_document ?? existing.source_document,
        }),
        user.userId
      );

      const { data: updated, error } = await supabase
        .from("p4_narrative_library_chunks")
        .update({
          chunk_type: p4Type,
          content,
          word_count: excerpt.split(/\s+/).filter(Boolean).length,
          embedding,
          metadata,
        })
        .eq("id", chunkId)
        .eq("tenant_id", user.userId)
        .select("id, chunk_type, source_document, chunk_index, content, metadata")
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });

      await recordWikiHumanEffort(supabase, {
        tenantId: user.userId,
        actorId: user.userId,
        manuscriptId,
        action: "update",
        title,
        chunkId,
        outlineEntityKind: outline_entity_kind || chunk_type_raw,
        humanEffort: human_effort,
      });

      return res.status(200).json({ success: true, chunk: updated });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "Update failed" });
    }
  }
);

/**
 * POST /api/wiki/:manuscriptId/entries/:chunkId/scrap — soft delete → scrapped ideas.
 */
wikiEntriesController.post(
  "/api/wiki/:manuscriptId/entries/:chunkId/scrap",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const chunkId = String(req.params.chunkId ?? "").trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const human_effort =
      body.human_effort != null && typeof body.human_effort === "object" && !Array.isArray(body.human_effort)
        ? (body.human_effort as HumanEffortPayload)
        : null;

    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, metadata")
      .eq("id", chunkId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Wiki entry not found" });

    const prevMeta = (existing.metadata && typeof existing.metadata === "object"
      ? existing.metadata
      : {}) as Record<string, unknown>;
    if (!chunkMatchesManuscript(prevMeta, manuscriptId)) {
      return res.status(403).json({ error: "Entry does not belong to this manuscript" });
    }

    const now = new Date().toISOString();
    const title = String(prevMeta.proposed_chunk_title ?? "Wiki entry");
    const nextMeta = {
      ...prevMeta,
      wiki_scrapped_at: now,
      wiki_visibility: "draft",
      wiki_scrapped_reason: String(body.reason ?? "author_deleted").slice(0, 200),
    };

    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({ metadata: nextMeta, is_deleted: true })
      .eq("id", chunkId)
      .eq("tenant_id", user.userId);

    if (error) return res.status(500).json({ error: error.message });

    await recordWikiHumanEffort(supabase, {
      tenantId: user.userId,
      actorId: user.userId,
      manuscriptId,
      action: "scrap",
      title,
      chunkId,
      outlineEntityKind: String(prevMeta.outline_entity_kind ?? ""),
      humanEffort: human_effort,
    });

    return res.status(200).json({ success: true, scrapped_at: now });
  }
);

/**
 * POST /api/wiki/:manuscriptId/entries/:chunkId/restore — restore from scrapped ideas.
 */
wikiEntriesController.post(
  "/api/wiki/:manuscriptId/entries/:chunkId/restore",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const chunkId = String(req.params.chunkId ?? "").trim();
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from("p4_narrative_library_chunks")
      .select("id, metadata")
      .eq("id", chunkId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Wiki entry not found" });

    const prevMeta = (existing.metadata && typeof existing.metadata === "object"
      ? existing.metadata
      : {}) as Record<string, unknown>;
    if (!chunkMatchesManuscript(prevMeta, manuscriptId)) {
      return res.status(403).json({ error: "Entry does not belong to this manuscript" });
    }

    const { wiki_scrapped_at: _s, wiki_scrapped_reason: _r, ...rest } = prevMeta;
    const nextMeta = { ...rest, wiki_restored_at: new Date().toISOString() };

    const { error } = await supabase
      .from("p4_narrative_library_chunks")
      .update({ metadata: nextMeta, is_deleted: false })
      .eq("id", chunkId)
      .eq("tenant_id", user.userId);

    if (error) return res.status(500).json({ error: error.message });

    await recordWikiHumanEffort(supabase, {
      tenantId: user.userId,
      actorId: user.userId,
      manuscriptId,
      action: "restore",
      title: String(prevMeta.proposed_chunk_title ?? "Wiki entry"),
      chunkId,
      outlineEntityKind: String(prevMeta.outline_entity_kind ?? ""),
    });

    return res.status(200).json({ success: true });
  }
);

/**
 * GET /api/wiki/:manuscriptId/scrapped — scrapped ideas bin.
 */
wikiEntriesController.get("/api/wiki/:manuscriptId/scrapped", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("p4_narrative_library_chunks")
    .select("id, chunk_type, source_document, chunk_index, content, metadata, created_at, is_deleted")
    .eq("tenant_id", user.userId)
    .eq("is_deleted", true)
    .in("chunk_type", ["lore", "plot", "character"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });

  const scrapped = (rows ?? []).filter((r) => {
    const meta = (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<string, unknown>;
    return chunkMatchesManuscript(meta, manuscriptId);
  });

  return res.status(200).json({ manuscript_id: manuscriptId, scrapped });
});
