import { Router, type Request, type Response } from "express";

import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  countOpenLoreMerges,
  getLoreMerge,
  listLoreMerges,
  markLoreMergeNotificationsRead,
  resolveLoreMerge,
  type LoreMergeStatus,
} from "../lib/wikiLoreMerges.js";

export const wikiLoreMergesController = Router();

async function assertManuscriptOwned(tenantId: string, manuscriptId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("id", manuscriptId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

/** GET /api/wiki/merges/notifications?manuscript_id= */
wikiLoreMergesController.get(
  "/api/wiki/merges/notifications",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;
    const manuscriptId = String(req.query.manuscript_id ?? "").trim();
    if (!manuscriptId) return res.status(400).json({ error: "manuscript_id is required" });
    if (!(await assertManuscriptOwned(user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }
    try {
      const counts = await countOpenLoreMerges(getSupabaseAdmin(), user.userId, manuscriptId);
      return res.json({
        open: counts.open,
        unread: counts.unread,
        message:
          counts.open > 0
            ? `${counts.open} lore conflict(s) need review in Lore Merges`
            : "No open lore merges",
      });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);

/** GET /api/wiki/merges?manuscript_id=&status=open|all */
wikiLoreMergesController.get("/api/wiki/merges", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;
  const manuscriptId = String(req.query.manuscript_id ?? "").trim();
  const statusRaw = String(req.query.status ?? "open").trim();
  if (!manuscriptId) return res.status(400).json({ error: "manuscript_id is required" });
  if (!(await assertManuscriptOwned(user.userId, manuscriptId))) {
    return res.status(404).json({ error: "Manuscript not found" });
  }
  const status = (statusRaw === "all" ? "all" : statusRaw) as LoreMergeStatus | "all";
  try {
    const merges = await listLoreMerges(getSupabaseAdmin(), {
      tenantId: user.userId,
      manuscriptId,
      status,
    });
    return res.json({ merges, count: merges.length });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

/** GET /api/wiki/merges/:id */
wikiLoreMergesController.get("/api/wiki/merges/:id", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;
  const id = String(req.params.id ?? "").trim();
  try {
    const merge = await getLoreMerge(getSupabaseAdmin(), {
      tenantId: user.userId,
      mergeId: id,
    });
    if (!merge) return res.status(404).json({ error: "Merge not found" });
    return res.json({ merge });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

/** POST /api/wiki/merges/:id/resolve */
wikiLoreMergesController.post(
  "/api/wiki/merges/:id/resolve",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;
    const id = String(req.params.id ?? "").trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? "").trim() as
      | "keep_base"
      | "accept_incoming"
      | "edit_merge"
      | "dismiss";
    if (!["keep_base", "accept_incoming", "edit_merge", "dismiss"].includes(action)) {
      return res.status(400).json({
        error: "action must be keep_base|accept_incoming|edit_merge|dismiss",
      });
    }
    const edited =
      body.edited != null && typeof body.edited === "object"
        ? (body.edited as { title?: string; excerpt?: string })
        : undefined;
    try {
      const merge = await resolveLoreMerge(getSupabaseAdmin(), {
        tenantId: user.userId,
        mergeId: id,
        action,
        edited,
        note: body.note != null ? String(body.note) : undefined,
      });
      return res.json({ ok: true, merge });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = /not found/i.test(msg) ? 404 : /already/i.test(msg) ? 409 : 500;
      return res.status(code).json({ error: msg });
    }
  }
);

/** POST /api/wiki/merges/notifications/read */
wikiLoreMergesController.post(
  "/api/wiki/merges/notifications/read",
  async (req: Request, res: Response) => {
    const user = readBearerUser(req, res);
    if (!user) return;
    const manuscriptId = String(
      (req.body as { manuscript_id?: string })?.manuscript_id ?? req.query.manuscript_id ?? ""
    ).trim();
    if (!manuscriptId) return res.status(400).json({ error: "manuscript_id is required" });
    if (!(await assertManuscriptOwned(user.userId, manuscriptId))) {
      return res.status(404).json({ error: "Manuscript not found" });
    }
    try {
      const n = await markLoreMergeNotificationsRead(getSupabaseAdmin(), {
        tenantId: user.userId,
        manuscriptId,
      });
      return res.json({ ok: true, marked: n });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);
