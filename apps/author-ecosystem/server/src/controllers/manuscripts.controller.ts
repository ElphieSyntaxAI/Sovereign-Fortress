import { Router, type Request, type Response } from "express";

import { extractGoogleDocId, normalizeGoogleDocUrl } from "../lib/googleDocUrl.js";
import {
  canFinishRevisions,
  canSetPhase,
  parseProjectPhase,
  type ManuscriptPhaseRow,
  type ProjectPhase,
} from "../lib/manuscriptPhaseRules.js";
import { lockWikiForManuscriptRevision } from "../lib/wikiRevisionLock.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const manuscriptsController = Router();

const MANUSCRIPT_SELECT =
  "id, tenant_id, title, outline, revision_status, updated_at, lock_expires_at, revision_cooldown_until, cooldown_revision_status, locked_until, cooldown_duration, series_id, project_phase, google_doc_url, google_doc_id, companion_google_docs, hal_extension_enabled, linked_at, revisions_completed_at, wiki_revision_locked_at";

type HubManuscriptRow = ManuscriptPhaseRow &
  Record<string, unknown> & {
    id: string;
    series_id: string | null;
    linked_at: string | null;
  };

function phaseBuckets(rows: HubManuscriptRow[]) {
  const norm = (r: HubManuscriptRow) => parseProjectPhase(r.project_phase) ?? "working";
  return {
    working: rows.filter((r) => norm(r) === "working"),
    editing: rows.filter((r) => norm(r) === "editing"),
    finished: rows.filter((r) => norm(r) === "finished"),
  };
}

/**
 * GET /api/manuscripts/hub
 * Series folders, unlinked drafts, and linked kanban columns (standalone + per series).
 */
manuscriptsController.get("/api/manuscripts/hub", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const [msRes, seriesRes] = await Promise.all([
    supabase
      .from("p4_manuscripts")
      .select(MANUSCRIPT_SELECT)
      .eq("tenant_id", user.userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("p4_series")
      .select("id, tenant_id, title, created_at, updated_at")
      .eq("tenant_id", user.userId)
      .order("updated_at", { ascending: false }),
  ]);

  if (msRes.error) {
    console.error("[manuscripts/hub] manuscripts", msRes.error.message);
    return res.status(500).json({ error: msRes.error.message });
  }
  if (seriesRes.error) {
    console.error("[manuscripts/hub] series", seriesRes.error.message);
    return res.status(500).json({ error: seriesRes.error.message });
  }

  const all = (msRes.data ?? []) as HubManuscriptRow[];
  const isLinked = (r: HubManuscriptRow) =>
    Boolean(r.linked_at) || Boolean(r.google_doc_id && r.hal_extension_enabled);
  const unlinked = all.filter((r) => !isLinked(r));
  const linked = all.filter((r) => isLinked(r));
  const standaloneLinked = linked.filter((r) => r.series_id == null);

  const seriesList = (seriesRes.data ?? []) as { id: string; title: string }[];
  const seriesBoards = seriesList.map((s) => {
    const inSeries = linked.filter((r) => r.series_id === s.id);
    return {
      series: s,
      columns: phaseBuckets(inSeries),
    };
  });

  return res.status(200).json({
    unlinked,
    standalone: phaseBuckets(standaloneLinked),
    series: seriesBoards,
  });
});

/**
 * POST /api/series
 * Body: { title }
 */
manuscriptsController.post("/api/series", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const title = String((req.body as { title?: unknown })?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("p4_series")
    .insert({ tenant_id: user.userId, title, updated_at: now })
    .select("id, tenant_id, title, created_at, updated_at")
    .single();

  if (error) {
    console.error("[series] create", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ series: data });
});

/**
 * PATCH /api/series/:seriesId
 * Body: { title }
 */
manuscriptsController.patch("/api/series/:seriesId", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const seriesId = String(req.params.seriesId ?? "").trim();
  const title = String((req.body as { title?: unknown })?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("p4_series")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", seriesId)
    .eq("tenant_id", user.userId)
    .select("id, tenant_id, title, created_at, updated_at")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Series not found" });
  return res.status(200).json({ series: data });
});

/**
 * DELETE /api/series/:seriesId
 * Unlinks books (series_id → null); does not delete manuscripts.
 */
manuscriptsController.delete("/api/series/:seriesId", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const seriesId = String(req.params.seriesId ?? "").trim();
  const supabase = getSupabaseAdmin();

  const { data: seriesRow } = await supabase
    .from("p4_series")
    .select("id")
    .eq("id", seriesId)
    .eq("tenant_id", user.userId)
    .maybeSingle();
  if (!seriesRow) return res.status(404).json({ error: "Series not found" });

  const { error: unlinkErr } = await supabase
    .from("p4_manuscripts")
    .update({ series_id: null, updated_at: new Date().toISOString() })
    .eq("series_id", seriesId)
    .eq("tenant_id", user.userId);
  if (unlinkErr) return res.status(500).json({ error: unlinkErr.message });

  const { error: delErr } = await supabase
    .from("p4_series")
    .delete()
    .eq("id", seriesId)
    .eq("tenant_id", user.userId);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.status(200).json({ success: true, deleted: true });
});

/**
 * POST /api/manuscripts
 * Body: { title, series_id? }
 */
manuscriptsController.post("/api/manuscripts", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as { title?: unknown; series_id?: unknown };
  const title = String(body.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });

  const seriesId =
    body.series_id != null && String(body.series_id).trim() !== ""
      ? String(body.series_id).trim()
      : null;

  const supabase = getSupabaseAdmin();
  if (seriesId) {
    const { data: seriesRow } = await supabase
      .from("p4_series")
      .select("id")
      .eq("id", seriesId)
      .eq("tenant_id", user.userId)
      .maybeSingle();
    if (!seriesRow) return res.status(400).json({ error: "series_id not found for this tenant" });
  }

  const { data, error } = await supabase
    .from("p4_manuscripts")
    .insert({
      tenant_id: user.userId,
      title,
      series_id: seriesId,
      project_phase: "working",
    })
    .select(MANUSCRIPT_SELECT)
    .single();

  if (error) {
    console.error("[manuscripts] create", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ manuscript: data });
});

/**
 * PATCH /api/manuscripts/:manuscriptId
 * Body: { project_phase?, title? }
 */
manuscriptsController.patch("/api/manuscripts/:manuscriptId", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  if (!manuscriptId) return res.status(400).json({ error: "manuscriptId is required" });

  const body = (req.body ?? {}) as { project_phase?: unknown; title?: unknown; outline?: unknown };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = String(body.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "title cannot be empty" });
    patch.title = title;
  }
  if (body.outline !== undefined) {
    patch.outline = String(body.outline ?? "");
  }
  const supabase = getSupabaseAdmin();

  if (body.project_phase !== undefined) {
    const phase = parseProjectPhase(body.project_phase);
    if (!phase) {
      return res.status(400).json({ error: "project_phase must be working, editing, or finished" });
    }

    const { data: current, error: readErr } = await supabase
      .from("p4_manuscripts")
      .select(MANUSCRIPT_SELECT)
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (readErr) return res.status(500).json({ error: readErr.message });
    if (!current) return res.status(404).json({ error: "Manuscript not found" });

    const gate = canSetPhase(current as ManuscriptPhaseRow, phase);
    if (!gate.ok) return res.status(400).json({ error: gate.error });

    patch.project_phase = phase;
  }

  if (Object.keys(patch).length <= 1) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const { data, error } = await supabase
    .from("p4_manuscripts")
    .update(patch)
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .select(MANUSCRIPT_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[manuscripts] patch", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: "Manuscript not found" });

  return res.status(200).json({ manuscript: data });
});

/**
 * POST /api/manuscripts/:manuscriptId/link-google-doc
 * Body: { url } — links doc, enables HAL extension flag, moves project into Current projects.
 */
manuscriptsController.post(
  "/api/manuscripts/:manuscriptId/link-google-doc",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const url = String((req.body as { url?: unknown })?.url ?? "").trim();
    if (!manuscriptId) return res.status(400).json({ error: "manuscriptId is required" });
    if (!url) return res.status(400).json({ error: "url is required" });

    const docId = extractGoogleDocId(url);
    if (!docId) {
      return res.status(400).json({
        error: "Could not parse Google Doc id — use a docs.google.com/document/d/… URL",
      });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("p4_manuscripts")
      .update({
        google_doc_url: normalizeGoogleDocUrl(url),
        google_doc_id: docId,
        hal_extension_enabled: true,
        linked_at: now,
        project_phase: "working",
        updated_at: now,
      })
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .select(MANUSCRIPT_SELECT)
      .maybeSingle();

    if (error) {
      console.error("[manuscripts] link-google-doc", error.message);
      return res.status(500).json({ error: error.message });
    }
    if (!data) return res.status(404).json({ error: "Manuscript not found" });

    return res.status(200).json({
      manuscript: data,
      hal_hint:
        "Open the linked Google Doc with the Elphie Syntax extension installed, then use Sync session in the side panel after selecting this manuscript in the web dashboard.",
    });
  }
);

/**
 * GET /api/manuscripts/active
 */
manuscriptsController.get("/api/manuscripts/active", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("p4_manuscripts")
    .select(MANUSCRIPT_SELECT)
    .eq("tenant_id", user.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[manuscripts/active]", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ manuscript: data ?? null });
});

/**
 * POST /api/manuscripts/:manuscriptId/touch
 */
manuscriptsController.post("/api/manuscripts/:manuscriptId/touch", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  if (!manuscriptId) {
    return res.status(400).json({ error: "manuscriptId is required" });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("p4_manuscripts")
    .update({ updated_at: now })
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[manuscripts/touch]", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: "Manuscript not found for this user" });
  }

  return res.status(204).end();
});

/**
 * GET /api/manuscripts
 */
manuscriptsController.get("/api/manuscripts", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("p4_manuscripts")
    .select(MANUSCRIPT_SELECT)
    .eq("tenant_id", user.userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[manuscripts] list", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ manuscripts: data ?? [] });
});

/**
 * POST /api/manuscripts/:manuscriptId/finish-revisions
 * Body: { confirm: true, reason?: string } — locks wiki canon and moves to Finished.
 */
manuscriptsController.post(
  "/api/manuscripts/:manuscriptId/finish-revisions",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const body = (req.body ?? {}) as { confirm?: unknown; reason?: unknown };
    if (body.confirm !== true && String(body.confirm).toLowerCase() !== "true") {
      return res.status(400).json({ error: "confirm: true is required" });
    }

    const supabase = getSupabaseAdmin();
    const { data: row, error: readErr } = await supabase
      .from("p4_manuscripts")
      .select(MANUSCRIPT_SELECT)
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (readErr) return res.status(500).json({ error: readErr.message });
    if (!row) return res.status(404).json({ error: "Manuscript not found" });

    const gate = canFinishRevisions(row as ManuscriptPhaseRow);
    if (!gate.ok) return res.status(400).json({ error: gate.error });

    const now = new Date().toISOString();
    let chunks_updated = 0;
    try {
      const lock = await lockWikiForManuscriptRevision(supabase, user.userId, manuscriptId);
      chunks_updated = lock.chunks_updated;
    } catch (e) {
      console.error("[manuscripts/finish-revisions] wiki lock", e);
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Failed to lock wiki lore",
      });
    }

    const { data, error } = await supabase
      .from("p4_manuscripts")
      .update({
        project_phase: "finished",
        wiki_revision_locked_at: now,
        updated_at: now,
      })
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .select(MANUSCRIPT_SELECT)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const reason = String(body.reason ?? "").trim();
    if (reason.length >= 10) {
      await supabase.from("p4_wiki_unlock_requests").insert({
        tenant_id: user.userId,
        manuscript_id: manuscriptId,
        reason: `[pre-lock note] ${reason}`,
        status: "pending",
      });
    }

    return res.status(200).json({
      manuscript: data,
      wiki_chunks_locked: chunks_updated,
      message:
        "Wiki lore is locked at this revision point. To edit earlier wiki state you must email support to verify admin access and provide a reason.",
    });
  }
);
