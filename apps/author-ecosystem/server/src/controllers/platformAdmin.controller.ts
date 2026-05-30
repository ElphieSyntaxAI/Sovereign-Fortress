import { Router, type Request, type Response } from "express";

import { createBffSupabaseServerClient } from "../lib/bffSupabaseSsr.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { resolvePlatformOperatorAccess } from "../lib/isPlatformOperator.js";
import { fetchPlatformAdminOverview } from "../lib/platformAdminOverview.js";

export const platformAdminController = Router();

/** GET /api/platform-admin/access */
platformAdminController.get("/api/platform-admin/access", (req, res) => {
  void (async () => {
    try {
      const supabase = createBffSupabaseServerClient(req, res);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.email) {
        res.status(401).json({ authenticated: false, is_platform_operator: false });
        return;
      }
      const is_platform_operator = await resolvePlatformOperatorAccess(getSupabaseAdmin(), {
        email: data.user.email,
        userId: data.user.id,
      });
      res.status(200).json({
        authenticated: true,
        email: data.user.email,
        is_platform_operator,
      });
    } catch (e) {
      console.error("[platform-admin/access]", e);
      res.status(500).json({ authenticated: false, is_platform_operator: false });
    }
  })();
});

/** GET /api/platform-admin/overview — operator-only platform metrics */
platformAdminController.get("/api/platform-admin/overview", (req, res) => {
  void (async () => {
    try {
      const supabase = createBffSupabaseServerClient(req, res);
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        res.status(401).json({ error: "Not authenticated." });
        return;
      }
      const isOperator = await resolvePlatformOperatorAccess(getSupabaseAdmin(), {
        email: data.user.email,
        userId: data.user.id,
      });
      if (!isOperator) {
        res.status(403).json({
          error:
            "Platform operator access required. Sign in via MSGF admin handoff or set GLOBAL_ADMIN on p4_profiles / MSGF_GLOBAL_ADMIN_EMAILS.",
        });
        return;
      }
    } catch (e) {
      console.error("[platform-admin/overview] auth", e);
      res.status(401).json({ error: "Not authenticated." });
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
