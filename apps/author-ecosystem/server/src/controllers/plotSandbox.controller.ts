import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";

import { P4_HAL_LEDGER } from "../lib/database/canonicalIdentifiers.js";
import { assertUuid } from "../lib/halMetrics.js";
import { assertBffManuscriptTenantSession } from "../middleware/author-gate.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  formatCombinedNarrativeAudit,
  runDualSceneAudit,
  type SceneAuditSnapshot,
} from "../services/AuditService.js";

export const plotSandboxController = Router();

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * POST /api/plot-sandbox/simulate-impact
 * Body: { manuscript_id, tenant_id, scene_card_id, scene_index, scene_label?, scene_beat_text?,
 *         environment, characters, tropes, wiki_state_text?, manuscript_outline_snapshot? }
 */
plotSandboxController.post("/api/plot-sandbox/simulate-impact", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = req.body as Record<string, unknown>;
  let manuscriptId: string;
  let tenantId: string;
  try {
    manuscriptId = assertUuid(String(body.manuscript_id ?? ""), "manuscript_id");
    tenantId = assertUuid(String(body.tenant_id ?? ""), "tenant_id");
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid id" });
  }

  const scene_card_id = String(body.scene_card_id ?? "").trim() || randomUUID();
  const scene_index = Number(body.scene_index);
  if (!Number.isFinite(scene_index) || scene_index < 0) {
    return res.status(400).json({ error: "scene_index must be a non-negative number" });
  }

  const environment = String(body.environment ?? "");
  const cast = String(body.cast ?? body.characters ?? "");
  const logic_hooks = String(body.logic_hooks ?? body.tropes ?? "");
  const scene_label = String(body.scene_label ?? "").trim() || `Scene ${scene_index + 1}`;
  const scene_beat_text = String(body.scene_beat_text ?? "").trim();
  const wiki_state_text = String(body.wiki_state_text ?? "").trim();
  const manuscript_outline_snapshot = String(body.manuscript_outline_snapshot ?? "").trim();

  const supabase = getSupabaseAdmin();
  const sess = await assertBffManuscriptTenantSession(supabase, { manuscriptId, tenantId });
  if (!sess.ok) {
    const status = /not found/i.test(sess.reason) ? 404 : 403;
    return res.status(status).json({ error: sess.reason });
  }

  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("outline")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) {
    console.error("[plot-sandbox] manuscript read", msErr.message);
    return res.status(500).json({ error: msErr.message });
  }

  const outlineFromDb = String((ms as { outline?: string | null }).outline ?? "").trim();

  const snapshot: SceneAuditSnapshot = {
    scene_label,
    scene_beat_text,
    environment,
    cast,
    logic_hooks,
    wiki_state_text,
    manuscript_outline_snapshot,
    manuscript_outline_db: outlineFromDb,
  };

  let librarian_logic: string;
  let critic_sensitivity: string;
  let narrative_audit: string;
  try {
    const dual = await runDualSceneAudit(snapshot);
    librarian_logic = dual.librarianLogic;
    critic_sensitivity = dual.criticSensitivity;
    narrative_audit = formatCombinedNarrativeAudit(dual);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[plot-sandbox] dual audit", msg);
    return res.status(502).json({ error: "Narrative audit generation failed", detail: msg });
  }

  const sessionId = randomUUID();
  let author_user_id: string | null = null;
  try {
    author_user_id = assertUuid(user.userId, "author_user_id");
  } catch {
    author_user_id = null;
  }

  const raw_sample = {
    manuscriptId,
    plot_sandbox_audit: true,
    scene_card_id,
    scene_index,
    scene_label,
    scene_beat_text: scene_beat_text || null,
    environment,
    characters: cast,
    tropes: logic_hooks,
    librarian_logic,
    critic_sensitivity,
    narrative_audit,
    wiki_state_digest_chars: wiki_state_text.length,
    manuscript_outline_digest_chars: manuscript_outline_snapshot.length,
  };

  const stylometric_snapshot = {
    plot_sandbox_audit: true,
    narrative_audit,
    librarian_logic,
    critic_sensitivity,
    scene_index,
  };

  const { data: inserted, error: insErr } = await supabase
    .from(P4_HAL_LEDGER)
    .insert({
      tenant_id: tenantId,
      author_user_id,
      session_id: sessionId,
      keystroke_latency_ms: [],
      manual_word_count: 0,
      ai_assisted_word_count: 1,
      stylometric_snapshot,
      raw_sample,
    })
    .select("id, created_at")
    .single();

  if (insErr) {
    console.error("[plot-sandbox] hal insert", insErr.message);
    return res.status(500).json({ error: "Failed to persist narrative audit to HAL ledger", detail: insErr.message });
  }

  return res.status(201).json({
    success: true,
    hal_ledger_id: inserted.id,
    created_at: inserted.created_at,
    librarian_logic,
    critic_sensitivity,
    narrative_audit,
  });
});

/**
 * GET /api/plot-sandbox/audit-log?manuscript_id=…
 * Recent plot-sandbox narrative audits for this manuscript (HAL ledger rows).
 */
plotSandboxController.get("/api/plot-sandbox/audit-log", async (req: Request, res: Response) => {
  if (!readBearerUser(req, res)) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.query.manuscript_id ?? req.query.manuscriptId ?? ""), "manuscript_id");
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid manuscript_id" });
  }

  const supabase = getSupabaseAdmin();
  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("tenant_id")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) return res.status(500).json({ error: msErr.message });
  if (!ms) return res.status(404).json({ error: "Manuscript not found" });

  const tenantId = String((ms as { tenant_id: string }).tenant_id);

  const { data: rows, error } = await supabase
    .from(P4_HAL_LEDGER)
    .select("id, created_at, raw_sample")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });

  const items: Array<Record<string, unknown>> = [];
  for (const row of rows ?? []) {
    const rec = row as Record<string, unknown>;
    const raw = asRecord(rec["raw_sample"]);
    if (String(raw["manuscriptId"] ?? "") !== manuscriptId) continue;

    if (raw["plot_sandbox_audit"] === true) {
      const libLog = raw["librarian_logic"] != null ? String(raw["librarian_logic"]) : "";
      const critic = raw["critic_sensitivity"] != null ? String(raw["critic_sensitivity"]) : "";
      items.push({
        kind: "impact",
        hal_ledger_id: String(rec["id"]),
        created_at: String(rec["created_at"] ?? ""),
        narrative_audit: String(raw["narrative_audit"] ?? ""),
        librarian_logic: libLog || String(raw["narrative_audit"] ?? ""),
        critic_sensitivity: critic,
        scene_card_id: String(raw["scene_card_id"] ?? ""),
        scene_index: typeof raw["scene_index"] === "number" ? raw["scene_index"] : Number(raw["scene_index"]),
        scene_label: raw["scene_label"] != null ? String(raw["scene_label"]) : null,
        environment: String(raw["environment"] ?? ""),
        cast: String(raw["characters"] ?? ""),
        logic_hooks: String(raw["tropes"] ?? ""),
      });
    }

    if (raw["narrative_logic_proof"] === true) {
      const outcome = String(raw["narrative_logic_outcome"] ?? "");
      const expl = String(raw["narrative_logic_explanation"] ?? raw["librarian_reply"] ?? "");
      items.push({
        kind: "logic_proof",
        hal_ledger_id: String(rec["id"]),
        created_at: String(rec["created_at"] ?? ""),
        narrative_audit: `[${outcome}] ${expl}`.trim(),
        narrative_logic_outcome: outcome,
        scene_card_id: String(raw["scene_card_id"] ?? ""),
        scene_index: typeof raw["scene_index"] === "number" ? raw["scene_index"] : Number(raw["scene_index"]),
        scene_label: raw["scene_label"] != null ? String(raw["scene_label"]) : null,
      });
    }
  }

  items.sort((a, b) => {
    const ta = new Date(String(a["created_at"] ?? 0)).getTime();
    const tb = new Date(String(b["created_at"] ?? 0)).getTime();
    return tb - ta;
  });

  return res.status(200).json({ success: true, manuscript_id: manuscriptId, audits: items });
});
