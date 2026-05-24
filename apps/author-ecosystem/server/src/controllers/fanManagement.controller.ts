import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const fanManagementController = Router();

const SIGNAL_SELECT =
  "id, kind, title, body, created_at, manuscript_id, read_at, payload";

/**
 * GET /api/fans/signals
 * Tenant-scoped fan / engagement signals for the business dashboard.
 */
fanManagementController.get("/api/fans/signals", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = typeof req.query.manuscript_id === "string" ? req.query.manuscript_id.trim() : "";
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 80));

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("p4_author_signal")
    .select(SIGNAL_SELECT)
    .eq("tenant_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (manuscriptId) {
    q = q.or(`manuscript_id.eq.${manuscriptId},manuscript_id.is.null`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[fans/signals]", error.message);
    return res.status(500).json({ error: error.message });
  }

  const unread = (data ?? []).filter((r) => {
    const row = r as { read_at?: string | null };
    return row.read_at == null;
  }).length;

  return res.status(200).json({ signals: data ?? [], unread_count: unread });
});

/**
 * PATCH /api/fans/signals/:id/read
 * Mark a signal as read (moderation / inbox hygiene).
 */
fanManagementController.patch("/api/fans/signals/:id/read", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "id is required" });

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("p4_author_signal")
    .update({ read_at: now })
    .eq("id", id)
    .eq("tenant_id", user.userId)
    .select("id, read_at")
    .maybeSingle();

  if (error) {
    console.error("[fans/signals/read]", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!data) return res.status(404).json({ error: "Signal not found" });

  return res.status(200).json({ signal: data });
});
