import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const manuscriptsController = Router();

/**
 * GET /api/manuscripts/active
 * Latest touched row for this tenant (use `POST /api/manuscripts/:id/touch` from the web dashboard when the author selects a manuscript).
 */
manuscriptsController.get("/api/manuscripts/active", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("p4_manuscripts")
    .select(
      "id, tenant_id, title, revision_status, updated_at, lock_expires_at, revision_cooldown_until, cooldown_revision_status, locked_until, cooldown_duration"
    )
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
 * Bumps `updated_at` so `GET /api/manuscripts/active` follows the dashboard selection.
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
 * Lists `p4_manuscripts` for the caller's tenant. Convention: `tenant_id` matches legacy JWT `user_id`
 * (single-tenant author). Uses service-role Supabase; scoped by verified JWT only.
 */
manuscriptsController.get("/api/manuscripts", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const tenantId = user.userId;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("p4_manuscripts")
    .select(
      "id, tenant_id, title, revision_status, updated_at, lock_expires_at, revision_cooldown_until, cooldown_revision_status, locked_until, cooldown_duration"
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[manuscripts] list", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ manuscripts: data ?? [] });
});
