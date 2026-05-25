import { Router, type Request, type Response } from "express";

import { createBffSupabaseServerClient } from "../lib/bffSupabaseSsr.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { isPlatformOperatorEmail } from "../lib/isPlatformOperator.js";
import { fetchPlatformAdminOverview } from "../lib/platformAdminOverview.js";

export const platformAdminController = Router();

async function resolveSessionEmail(req: Request, res: Response): Promise<string | null> {
  try {
    const supabase = createBffSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

/** GET /api/platform-admin/access */
platformAdminController.get("/api/platform-admin/access", (req, res) => {
  void (async () => {
    const email = await resolveSessionEmail(req, res);
    if (!email) {
      res.status(401).json({ authenticated: false, is_platform_operator: false });
      return;
    }
    res.status(200).json({
      authenticated: true,
      email,
      is_platform_operator: isPlatformOperatorEmail(email),
    });
  })();
});

/** GET /api/platform-admin/overview — operator-only platform metrics */
platformAdminController.get("/api/platform-admin/overview", (req, res) => {
  void (async () => {
    const email = await resolveSessionEmail(req, res);
    if (!email) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    if (!isPlatformOperatorEmail(email)) {
      res.status(403).json({
        error: "Platform operator access required. Sign in via MSGF admin or add your email to MSGF_GLOBAL_ADMIN_EMAILS.",
      });
      return;
    }
    try {
      const overview = await fetchPlatformAdminOverview(getSupabaseAdmin());
      res.status(200).json(overview);
    } catch (e) {
      console.error("[platform-admin/overview]", e);
      res.status(500).json({
        error: e instanceof Error ? e.message : "Could not load platform overview.",
      });
    }
  })();
});
