import { drive } from "@googleapis/drive";
import { Router, type Request, type Response } from "express";

import { extractGoogleDocId, normalizeGoogleDocUrl } from "../lib/googleDocUrl.js";
import { getGoogleOAuthClientForTenant } from "../lib/googleOAuthTokens.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const linkSessionController = Router();

const SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * GET /api/manuscripts/link-session/active
 * Latest open link session for this tenant (extension + dashboard polling).
 */
linkSessionController.get("/api/manuscripts/link-session/active", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("p4_manuscript_link_sessions")
    .select(
      "id, status, google_doc_id, google_doc_title, google_doc_url, reported_at, expires_at, manuscript_id"
    )
    .eq("tenant_id", user.userId)
    .in("status", ["pending", "reported"])
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ session: data ?? null });
});

const MANUSCRIPT_SELECT =
  "id, tenant_id, title, revision_status, updated_at, series_id, project_phase, google_doc_url, google_doc_id, hal_extension_enabled, linked_at";

/**
 * POST /api/manuscripts/:manuscriptId/link-session
 * Start a link session — author opens the doc in the browser, extension reports it, then confirms here.
 */
linkSessionController.post("/api/manuscripts/:manuscriptId/link-session", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  if (!manuscriptId) return res.status(400).json({ error: "manuscriptId is required" });

  const supabase = getSupabaseAdmin();
  const { data: ms } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (!ms) return res.status(404).json({ error: "Manuscript not found" });

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("p4_manuscript_link_sessions")
    .insert({
      tenant_id: user.userId,
      manuscript_id: manuscriptId,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, status, expires_at, created_at")
    .single();

  if (error) {
    console.error("[link-session] create", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({
    session: data,
    instructions:
      "Open your Google Doc in this browser with the HAL extension, click Report doc in the extension panel, then return here and click Link session to confirm.",
  });
});

/**
 * POST /api/manuscripts/link-session/:sessionId/report
 * Extension (or dashboard) reports the active Google Doc for this session.
 */
linkSessionController.post(
  "/api/manuscripts/link-session/:sessionId/report",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const sessionId = String(req.params.sessionId ?? "").trim();
    const body = (req.body ?? {}) as {
      google_doc_url?: string;
      google_doc_id?: string;
      google_doc_title?: string;
    };

    const url = String(body.google_doc_url ?? "").trim();
    const docId = String(body.google_doc_id ?? "").trim() || (url ? extractGoogleDocId(url) : "");
    if (!docId) {
      return res.status(400).json({ error: "google_doc_id or google_doc_url is required" });
    }

    const supabase = getSupabaseAdmin();
    const { data: session, error: fetchErr } = await supabase
      .from("p4_manuscript_link_sessions")
      .select("id, tenant_id, manuscript_id, status, expires_at")
      .eq("id", sessionId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "confirmed") {
      return res.status(400).json({ error: "Session already confirmed" });
    }
    if (new Date(String(session.expires_at)).getTime() < Date.now()) {
      await supabase
        .from("p4_manuscript_link_sessions")
        .update({ status: "expired" })
        .eq("id", sessionId);
      return res.status(410).json({ error: "Session expired — start a new link session" });
    }

    let title = String(body.google_doc_title ?? "").trim();
    if (!title) {
      try {
        const { client } = await getGoogleOAuthClientForTenant(supabase, user.userId);
        const d = drive({ version: "v3", auth: client });
        const meta = await d.files.get({ fileId: docId, fields: "name" });
        title = meta.data.name ? String(meta.data.name) : "Google Doc";
      } catch {
        title = "Google Doc";
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("p4_manuscript_link_sessions")
      .update({
        status: "reported",
        google_doc_id: docId,
        google_doc_url: url ? normalizeGoogleDocUrl(url) : normalizeGoogleDocUrl(`https://docs.google.com/document/d/${docId}/edit`),
        google_doc_title: title,
        reported_at: now,
      })
      .eq("id", sessionId)
      .select("id, status, google_doc_id, google_doc_title, google_doc_url, reported_at, expires_at, manuscript_id")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ session: updated });
  }
);

/**
 * GET /api/manuscripts/:manuscriptId/link-session/:sessionId
 */
linkSessionController.get(
  "/api/manuscripts/:manuscriptId/link-session/:sessionId",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const sessionId = String(req.params.sessionId ?? "").trim();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("p4_manuscript_link_sessions")
      .select(
        "id, status, google_doc_id, google_doc_title, google_doc_url, reported_at, confirmed_at, expires_at, manuscript_id"
      )
      .eq("id", sessionId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Session not found" });

    if (
      data.status !== "confirmed" &&
      new Date(String(data.expires_at)).getTime() < Date.now()
    ) {
      return res.status(200).json({ session: { ...data, status: "expired" } });
    }

    return res.status(200).json({ session: data });
  }
);

/**
 * POST /api/manuscripts/:manuscriptId/link-session/:sessionId/confirm
 * Author confirms the reported doc is the correct project (enables HAL + current projects).
 */
linkSessionController.post(
  "/api/manuscripts/:manuscriptId/link-session/:sessionId/confirm",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const sessionId = String(req.params.sessionId ?? "").trim();
    const supabase = getSupabaseAdmin();

    const { data: session, error: fetchErr } = await supabase
      .from("p4_manuscript_link_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("manuscript_id", manuscriptId)
      .eq("tenant_id", user.userId)
      .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "reported" || !session.google_doc_id) {
      return res.status(400).json({
        error:
          "No doc reported yet. Open the Google Doc with the extension and click Report doc, then try Link session again.",
      });
    }

    try {
      const { client } = await getGoogleOAuthClientForTenant(supabase, user.userId);
      const d = drive({ version: "v3", auth: client });
      await d.files.get({
        fileId: String(session.google_doc_id),
        fields: "id,name",
        supportsAllDrives: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(403).json({
        error: `Google account cannot access this doc. Share the doc with your connected Google account or reconnect OAuth. (${msg})`,
      });
    }

    const now = new Date().toISOString();
    const { error: msErr } = await supabase
      .from("p4_manuscripts")
      .update({
        google_doc_id: session.google_doc_id,
        google_doc_url: session.google_doc_url,
        hal_extension_enabled: true,
        linked_at: now,
        updated_at: now,
      })
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId);

    if (msErr) return res.status(500).json({ error: msErr.message });

    await supabase
      .from("p4_manuscript_link_sessions")
      .update({ status: "confirmed", confirmed_at: now })
      .eq("id", sessionId);

    const { data: manuscript } = await supabase
      .from("p4_manuscripts")
      .select(MANUSCRIPT_SELECT)
      .eq("id", manuscriptId)
      .single();

    return res.status(200).json({
      manuscript,
      message: "Link session confirmed. HAL extension and Librarian sync are scoped to this doc.",
    });
  }
);
