import { Router, type Request, type Response } from "express";

import {
  DashboardOrchestratorService,
  type DashboardMode,
} from "../lib/DashboardOrchestratorService.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const dashboardController = Router();

/**
 * GET /api/dashboard/planning?manuscript_id=…
 * Optional alias: ?project_id=… (same value sent when local project UUID matches `p4_manuscripts.id`).
 */
dashboardController.get("/api/dashboard/planning", async (req: Request, res: Response) => {
  if (!readBearerUser(req, res)) return;

  const q = req.query;
  const manuscriptId = String(
    q.manuscript_id ?? q.manuscriptId ?? q.project_id ?? q.projectId ?? ""
  ).trim();
  if (!manuscriptId) {
    return res.status(400).json({
      error: "manuscript_id (or project_id) query parameter is required",
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const orch = new DashboardOrchestratorService(supabase);
    const payload = await orch.getDashboardViewData("PLANNING", manuscriptId);
    return res.status(200).json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(msg) || /Manuscript not found/.test(msg)) {
      return res.status(404).json({ error: msg });
    }
    console.error("[api/dashboard/planning]", e);
    return res.status(500).json({ error: msg });
  }
});

const DASHBOARD_MODES: DashboardMode[] = ["PLANNING", "DRAFTING", "REVISION", "BUSINESS", "GROWTH"];

function parseDashboardMode(raw: unknown): DashboardMode | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return DASHBOARD_MODES.includes(s as DashboardMode) ? (s as DashboardMode) : null;
}

/**
 * GET /api/dashboard/view?mode=PLANNING&manuscript_id=…
 * Same payload shape as `getDashboardViewData` for every dashboard mode (used by `DashboardRouter.loadView`).
 */
dashboardController.get("/api/dashboard/view", async (req: Request, res: Response) => {
  if (!readBearerUser(req, res)) return;

  const q = req.query;
  const manuscriptId = String(
    q.manuscript_id ?? q.manuscriptId ?? q.project_id ?? q.projectId ?? ""
  ).trim();
  if (!manuscriptId) {
    return res.status(400).json({
      error: "manuscript_id (or project_id) query parameter is required",
    });
  }

  const mode = parseDashboardMode(q.mode ?? q.dashboard_mode);
  if (!mode) {
    return res.status(400).json({
      error: `mode must be one of: ${DASHBOARD_MODES.join(", ")}`,
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const orch = new DashboardOrchestratorService(supabase);
    const payload = await orch.getDashboardViewData(mode, manuscriptId);
    return res.status(200).json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(msg) || /Manuscript not found/.test(msg)) {
      return res.status(404).json({ error: msg });
    }
    console.error("[api/dashboard/view]", e);
    return res.status(500).json({ error: msg });
  }
});
