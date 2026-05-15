import { Router, type Request, type Response } from "express";

import { healthService } from "msgf/connector/server";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const msgfHealthController = Router();

/**
 * GET /api/msgf/health/pillars
 * Author-scoped six-pillar stoplight (session cookie or Bearer JWT).
 */
msgfHealthController.get("/api/msgf/health/pillars", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const lookbackRaw = req.query.lookback_hours;
  const lookbackHours = Number(lookbackRaw ?? 168);

  try {
    const supabase = getSupabaseAdmin();
    const report = await healthService.getPillarHealth(supabase, {
      userId: user.userId,
      lookbackHours: Number.isFinite(lookbackHours) ? lookbackHours : 168,
    });

    return res.status(200).json({
      ok: true,
      ...report,
      scope: { user_id: user.userId, global: false },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load pillar health.";
    console.error("[api/msgf/health/pillars]", e);
    return res.status(500).json({ ok: false, error: msg });
  }
});
