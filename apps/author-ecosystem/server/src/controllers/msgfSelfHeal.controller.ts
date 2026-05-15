import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";

export const msgfSelfHealController = Router();

/**
 * POST /api/msgf/self-heal/report
 * Author session → MSGF `POST /api/msgf/admin/self-heal/report` (service role + act-as-user).
 */
msgfSelfHealController.post("/api/msgf/self-heal/report", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    return res.status(500).json({
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the Author BFF.",
    });
  }

  const base = (process.env.MSGF_APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const url = `${base}/api/msgf/admin/self-heal/report`;

  const authorTenantId =
    process.env.MSGF_AUTHOR_TENANT_ID?.trim() || "author_ecosystem";
  const body =
    typeof req.body === "object" && req.body !== null
      ? {
          ...(req.body as Record<string, unknown>),
          entity_id: user.userId,
          author_id: user.userId,
          tenant_id:
            (req.body as Record<string, unknown>).tenant_id ?? authorTenantId,
        }
      : {
          entity_id: user.userId,
          author_id: user.userId,
          tenant_id: authorTenantId,
        };

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${serviceKey}`,
        "x-msgf-act-as-user": user.userId,
      },
      body: JSON.stringify(body),
    });

    const json: unknown = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Self-heal report proxy failed.";
    console.error("[api/msgf/self-heal/report]", e);
    return res.status(502).json({ ok: false, error: msg });
  }
});
