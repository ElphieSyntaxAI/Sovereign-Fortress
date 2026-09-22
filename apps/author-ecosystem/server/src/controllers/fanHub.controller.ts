import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import {
  authorPostMvpDisabledPayload,
  isAuthorFanHubEnabled,
  isAuthorFanHubRequestPath,
} from "../lib/postMvpGates.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const fanHubController = Router();

fanHubController.use((req, res, next) => {
  if (!isAuthorFanHubEnabled() && isAuthorFanHubRequestPath(req.path)) {
    res.status(404).json(authorPostMvpDisabledPayload("author_fan_hub"));
    return;
  }
  next();
});

const DEFAULT_MODULES = {
  polls: true,
  games: true,
  fan_rag: true,
  progress_bar: { enabled: false, shared: false },
  fan_mail: true,
  quizzes: true,
  fan_art_slots: 3,
};

/**
 * GET /api/fan-hub/:manuscriptId
 */
fanHubController.get("/api/fan-hub/:manuscriptId", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  const supabase = getSupabaseAdmin();

  const { data: ms } = await supabase
    .from("p4_manuscripts")
    .select("id, title")
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (!ms) return res.status(404).json({ error: "Manuscript not found" });

  const { data: config } = await supabase
    .from("p4_fan_hub_config")
    .select("id, template_id, theme, modules, updated_at")
    .eq("manuscript_id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  const { data: mail } = await supabase
    .from("p4_fan_mail")
    .select("id, fan_display_name, subject, body, read_at, created_at")
    .eq("manuscript_id", manuscriptId)
    .eq("tenant_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return res.status(200).json({
    config: config ?? {
      template_id: "aurora",
      theme: { primary: "#8b5cf6", accent: "#f59e0b", background: "#0a0612" },
      modules: DEFAULT_MODULES,
    },
    fan_mail: mail ?? [],
  });
});

/**
 * PUT /api/fan-hub/:manuscriptId
 * Body: { template_id?, theme?, modules? }
 */
fanHubController.put("/api/fan-hub/:manuscriptId", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const manuscriptId = String(req.params.manuscriptId ?? "").trim();
  const body = (req.body ?? {}) as {
    template_id?: string;
    theme?: Record<string, unknown>;
    modules?: Record<string, unknown>;
  };

  const supabase = getSupabaseAdmin();
  const { data: ms } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (!ms) return res.status(404).json({ error: "Manuscript not found" });

  const now = new Date().toISOString();
  const row = {
    tenant_id: user.userId,
    manuscript_id: manuscriptId,
    template_id: body.template_id?.trim() || "aurora",
    theme: body.theme ?? { primary: "#8b5cf6", accent: "#f59e0b", background: "#0a0612" },
    modules: body.modules ?? DEFAULT_MODULES,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("p4_fan_hub_config")
    .upsert(row, { onConflict: "tenant_id,manuscript_id" })
    .select("id, template_id, theme, modules, updated_at")
    .single();

  if (error) {
    console.error("[fan-hub] put", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ config: data });
});

/**
 * PATCH /api/fan-hub/:manuscriptId/mail/:mailId/read
 */
fanHubController.patch(
  "/api/fan-hub/:manuscriptId/mail/:mailId/read",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;

    const mailId = String(req.params.mailId ?? "").trim();
    const manuscriptId = String(req.params.manuscriptId ?? "").trim();
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("p4_fan_mail")
      .update({ read_at: now })
      .eq("id", mailId)
      .eq("manuscript_id", manuscriptId)
      .eq("tenant_id", user.userId)
      .select("id, read_at")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Message not found" });

    return res.status(200).json({ mail: data });
  }
);
