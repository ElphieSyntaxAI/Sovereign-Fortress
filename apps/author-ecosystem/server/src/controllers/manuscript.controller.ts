import { Router, type Request, type Response } from "express";
import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AnalyticsService } from "../services/AnalyticsService.js";
import { EditorLedgerService } from "../lib/EditorLedgerService.js";
import {
  EDITOR_HUB_QUALITY_REQUIREMENTS_TOOLTIP,
  evaluateManuscriptQualityForEditorHub,
} from "../lib/EditorRequestService.js";
import { postAuthorVerifyResult } from "../lib/authorMsgfGovernance.js";
import { P4_EDITOR_LEDGER } from "../lib/database/canonicalIdentifiers.js";
import { assertUuid, HalValidationError } from "../lib/halMetrics.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const manuscriptController = Router();

const MANUSCRIPT_UNLOCK_SELECT =
  "id, tenant_id, title, revision_status, updated_at, lock_expires_at, revision_cooldown_until, cooldown_revision_status, locked_until, cooldown_duration";

const REVISION_REPORT_LIST =
  "id, tenant_id, manuscript_id, locked_until_session, author_user_id, report_kind, report_json, model_used, created_at";

type RevisionReportRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  locked_until_session: string;
  author_user_id: string | null;
  report_kind: string;
  report_json: Record<string, unknown>;
  model_used: string | null;
  created_at: string;
};

async function latestCriticSensitivityText(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("p4_revision_reports")
    .select("details")
    .eq("manuscript_id", manuscriptId)
    .eq("finding_type", "CRITIC_SUMMARY")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const det = (data as { details?: unknown }).details;
  if (!det || typeof det !== "object") return null;
  const d = det as Record<string, unknown>;
  const raw = d["critic_summary"] ?? d["summary"];
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || null;
}

async function resolveLibrarianRevisionReport(
  supabase: SupabaseClient,
  manuscriptId: string,
  lockedUntilRaw: string | null | undefined
): Promise<RevisionReportRow | null> {
  if (lockedUntilRaw != null && String(lockedUntilRaw).trim() !== "") {
    const sessionKey = new Date(String(lockedUntilRaw)).toISOString();
    const { data: exact } = await supabase
      .from("revision_reports")
      .select(REVISION_REPORT_LIST)
      .eq("manuscript_id", manuscriptId)
      .eq("locked_until_session", sessionKey)
      .eq("report_kind", "librarian_logic")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exact) return exact as RevisionReportRow;
  }
  const { data: latest } = await supabase
    .from("revision_reports")
    .select(REVISION_REPORT_LIST)
    .eq("manuscript_id", manuscriptId)
    .eq("report_kind", "librarian_logic")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest as RevisionReportRow) ?? null;
}

/**
 * GET /api/manuscripts/:id/revision-dashboard
 *
 * Bicameral snapshot for Vault overlay: latest Librarian (`revision_reports`) + Critic (`p4_revision_reports`).
 */
manuscriptController.get("/api/manuscripts/:id/revision-dashboard", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const supabase = getSupabaseAdmin();
  const { data: ms, error } = await supabase
    .from("p4_manuscripts")
    .select(MANUSCRIPT_UNLOCK_SELECT)
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (error) {
    console.error("[manuscripts/revision-dashboard] read", error.message);
    return res.status(500).json({ error: error.message });
  }
  if (!ms) {
    return res.status(404).json({ error: "Manuscript not found for this user" });
  }

  const row = ms as Record<string, unknown>;
  const gate = String(row.cooldown_revision_status ?? "");
  const lockedUntilRaw = row.locked_until;
  const lockedUntilMs =
    lockedUntilRaw != null && String(lockedUntilRaw).trim() !== ""
      ? new Date(String(lockedUntilRaw)).getTime()
      : NaN;
  const vaultCooldownLockElapsed =
    gate === "LOCKED" && Number.isFinite(lockedUntilMs) && Date.now() >= lockedUntilMs;

  const [librarian_report, critic_sensitivity_text] = await Promise.all([
    resolveLibrarianRevisionReport(supabase, manuscriptId, lockedUntilRaw as string | null | undefined),
    latestCriticSensitivityText(supabase, manuscriptId),
  ]);

  return res.status(200).json({
    ok: true,
    manuscript: ms,
    librarian_report,
    critic_sensitivity_text,
    vault_cooldown_lock_elapsed: vaultCooldownLockElapsed,
  });
});

/**
 * GET /api/manuscripts/:id/editor-request-gate
 *
 * Editor hub quality gate (no HAL): {@link evaluateManuscriptQualityForEditorHub}.
 */
manuscriptController.get("/api/manuscripts/:id/editor-request-gate", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const supabase = getSupabaseAdmin();
  const { data: scoped, error: scopeErr } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (scopeErr) {
    console.error("[manuscripts/editor-request-gate] scope", scopeErr.message);
    return res.status(500).json({ error: scopeErr.message });
  }
  if (!scoped) {
    return res.status(404).json({ error: "Manuscript not found for this user" });
  }

  try {
    const gate = await evaluateManuscriptQualityForEditorHub(supabase, manuscriptId);
    return res.status(200).json({
      ok: true,
      requirements_tooltip: EDITOR_HUB_QUALITY_REQUIREMENTS_TOOLTIP,
      is_manuscript_quality_verified: gate.verified,
      allowed: gate.verified,
      revision_count: gate.revision_count,
      revision_status: gate.revision_status,
      manuscript_audit_score: gate.manuscript_audit_score,
      continuity_score: gate.continuity_score,
      checks: gate.checks,
      author_progress: gate.author_progress,
      reason: gate.reason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[manuscripts/editor-request-gate]", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/manuscripts/:id/editor-ledger/publisher-summary
 *
 * Publisher-facing per-editor narrative (hours, suggestions, high-friction bins) — see {@link EditorLedgerService.summaryReport}.
 */
manuscriptController.get("/api/manuscripts/:id/editor-ledger/publisher-summary", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const role = user.role.toUpperCase();
  if (role !== "PUBLISHER" && role !== "AUTHOR" && role !== "EDITOR") {
    return res.status(403).json({ error: "Publisher summary requires PUBLISHER, AUTHOR, or EDITOR role." });
  }

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const supabase = getSupabaseAdmin();
  let scope = supabase.from("p4_manuscripts").select("id").eq("id", manuscriptId);
  if (role === "AUTHOR") {
    scope = scope.eq("tenant_id", user.userId);
  }
  const { data: scoped, error: scopeErr } = await scope.maybeSingle();

  if (scopeErr) {
    console.error("[manuscripts/editor-ledger/publisher-summary] scope", scopeErr.message);
    return res.status(500).json({ error: scopeErr.message });
  }
  if (!scoped) {
    return res.status(404).json({ error: "Manuscript not found for this user" });
  }

  try {
    const ledger = new EditorLedgerService(supabase);
    const report = await ledger.summaryReport(manuscriptId);
    return res.status(200).json({ ok: true, ...report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[manuscripts/editor-ledger/publisher-summary]", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/manuscripts/:id/struggle-map
 *
 * HAL-derived friction map (chapter bins or 1k-word bins) for editor X-ray — see {@link AnalyticsService.getManuscriptStruggleMap}.
 */
manuscriptController.get("/api/manuscripts/:id/struggle-map", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const supabase = getSupabaseAdmin();
  const { data: scoped, error: scopeErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id")
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (scopeErr) {
    console.error("[manuscripts/struggle-map] scope", scopeErr.message);
    return res.status(500).json({ error: scopeErr.message });
  }
  if (!scoped) {
    return res.status(404).json({ error: "Manuscript not found for this user" });
  }

  try {
    const analytics = new AnalyticsService(supabase);
    const map = await analytics.getManuscriptStruggleMap(manuscriptId, user.userId);
    return res.status(200).json({ ok: true, ...map });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[manuscripts/struggle-map]", msg);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/manuscripts/:id/editor-ledger/poee
 *
 * Proof of Editorial Effort (POEE): immutable row in `p4_editor_ledger` for each editor suggestion
 * (manuscript `body_text` is not mutated here).
 */
manuscriptController.post("/api/manuscripts/:id/editor-ledger/poee", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  if (user.role !== "EDITOR") {
    return res.status(403).json({ error: "Only the EDITOR role may record POEE / suggestion ledger entries." });
  }

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const body = req.body as Record<string, unknown>;
  const sug = (body["suggestion"] && typeof body["suggestion"] === "object"
    ? body["suggestion"]
    : body) as Record<string, unknown>;

  const anchor_start = Number(sug["anchor_start"]);
  const anchor_end = Number(sug["anchor_end"]);
  const original_text = typeof sug["original_text"] === "string" ? sug["original_text"] : "";
  const replacement_text = typeof sug["replacement_text"] === "string" ? sug["replacement_text"] : "";
  const suggestion_id =
    typeof sug["id"] === "string" && sug["id"].trim() ? sug["id"].trim() : randomUUID();

  if (!Number.isFinite(anchor_start) || !Number.isFinite(anchor_end) || anchor_start < 0 || anchor_end < anchor_start) {
    return res.status(400).json({ error: "Invalid anchor_start / anchor_end" });
  }
  if (original_text.length > 200_000 || replacement_text.length > 200_000) {
    return res.status(400).json({ error: "Suggestion text too large" });
  }

  const supabase = getSupabaseAdmin();
  const { data: ms, error: mErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, body_text")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (mErr) {
    console.error("[manuscripts/editor-ledger/poee] read", mErr.message);
    return res.status(500).json({ error: mErr.message });
  }
  if (!ms) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  const prose = String((ms as Record<string, unknown>).body_text ?? "");
  const slice = prose.slice(anchor_start, anchor_end);
  if (slice !== original_text) {
    return res.status(400).json({
      error: "original_text does not match manuscript body_text at the given anchors (stale selection?).",
    });
  }

  const tenant_id = String((ms as Record<string, unknown>).tenant_id ?? "");
  const original_sha256 = createHash("sha256").update(original_text, "utf8").digest("hex");
  const replacement_sha256 = createHash("sha256").update(replacement_text, "utf8").digest("hex");

  const payload = {
    schema: "elphie.poee.suggestion.v1",
    suggestion_id,
    anchor_start,
    anchor_end,
    original_text_sha256: original_sha256,
    replacement_text_sha256: replacement_sha256,
    original_text_len: original_text.length,
    replacement_text_len: replacement_text.length,
    editor_user_id: user.userId,
    recorded_at: new Date().toISOString(),
  };

  const { data: row, error: insErr } = await supabase
    .from(P4_EDITOR_LEDGER)
    .insert({
      manuscript_id: manuscriptId,
      tenant_id,
      editor_user_id: user.userId,
      event_kind: "POEE",
      payload: {
        ...payload,
        original_text,
        replacement_text,
      },
    })
    .select("id, created_at")
    .single();

  if (insErr) {
    console.error("[manuscripts/editor-ledger/poee] insert", insErr.message);
    return res.status(500).json({ error: insErr.message });
  }

  return res.status(201).json({
    ok: true,
    ledger_id: row?.id,
    created_at: row?.created_at,
    suggestion_id,
  });
});

/**
 * POST /api/manuscripts/:id/editor-ledger/security-flag
 *
 * Anti-automation / publisher triage: `POTENTIAL_AI_INJECTION` rows (editors only).
 */
manuscriptController.post("/api/manuscripts/:id/editor-ledger/security-flag", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  if (user.role !== "EDITOR") {
    return res.status(403).json({ error: "Only the EDITOR role may record editor-ledger security flags." });
  }

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const body = req.body as Record<string, unknown>;
  const reason = String(body["reason"] ?? "suspicious_paste").trim().slice(0, 120) || "suspicious_paste";
  const clientDetail = body["detail"] && typeof body["detail"] === "object" ? (body["detail"] as Record<string, unknown>) : {};

  const supabase = getSupabaseAdmin();
  const { data: ms, error: mErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (mErr) {
    console.error("[manuscripts/editor-ledger/security-flag] read", mErr.message);
    return res.status(500).json({ error: mErr.message });
  }
  if (!ms) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  const tenant_id = String((ms as Record<string, unknown>).tenant_id ?? "");
  const payload = {
    schema: "elphie.editor_security.v1",
    reason,
    editor_user_id: user.userId,
    recorded_at: new Date().toISOString(),
    detail: clientDetail,
  };

  const { data: row, error: insErr } = await supabase
    .from(P4_EDITOR_LEDGER)
    .insert({
      manuscript_id: manuscriptId,
      tenant_id,
      editor_id: user.userId,
      event_kind: "POTENTIAL_AI_INJECTION",
      type: "STRUCTURAL_NOTE",
      char_count: reason.length,
      timestamp: new Date().toISOString(),
      payload,
    })
    .select("id, created_at")
    .single();

  if (insErr) {
    console.error("[manuscripts/editor-ledger/security-flag] insert", insErr.message);
    return res.status(500).json({ error: insErr.message });
  }

  return res.status(201).json({
    ok: true,
    ledger_id: row?.id,
    created_at: row?.created_at,
  });
});

/**
 * POST /api/manuscripts/:id/unlock
 *
 * SSOT: docs/AUTHOR_ECOSYSTEM_ROADMAP.md — when vault cooldown (`cooldown_revision_status = LOCKED`) has
 * `locked_until <= now()`, call `public.check_cooldown_expiry()` then return the Librarian logic JSON
 * (`revision_reports`) for that lock session plus fresh manuscript fields for `CoolDownLock.tsx`.
 */
manuscriptController.post("/api/manuscripts/:id/unlock", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "manuscript id");
  } catch (e) {
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }

  const supabase = getSupabaseAdmin();

  const { data: msBefore, error: readErr } = await supabase
    .from("p4_manuscripts")
    .select(MANUSCRIPT_UNLOCK_SELECT)
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (readErr) {
    console.error("[manuscripts/unlock] read", readErr.message);
    return res.status(500).json({ error: readErr.message });
  }
  if (!msBefore) {
    return res.status(404).json({ error: "Manuscript not found for this user" });
  }

  const gate = String((msBefore as Record<string, unknown>).cooldown_revision_status ?? "");
  const lockedUntilRaw = (msBefore as Record<string, unknown>).locked_until;

  if (gate !== "LOCKED") {
    const { data: msFresh, error: e2 } = await supabase
      .from("p4_manuscripts")
      .select(MANUSCRIPT_UNLOCK_SELECT)
      .eq("id", manuscriptId)
      .eq("tenant_id", user.userId)
      .maybeSingle();
    if (e2) {
      console.error("[manuscripts/unlock] refetch", e2.message);
      return res.status(500).json({ error: e2.message });
    }
    const lockedUntilRel = (msFresh as Record<string, unknown>).locked_until;
    const [revision_report, critic_sensitivity_text] = await Promise.all([
      resolveLibrarianRevisionReport(supabase, manuscriptId, lockedUntilRel as string | null | undefined),
      latestCriticSensitivityText(supabase, manuscriptId),
    ]);
    return res.status(200).json({
      ok: true,
      already_released: true,
      cooldown_revision_status: gate,
      revision_report,
      report_json: revision_report?.report_json ?? null,
      critic_sensitivity_text,
      manuscript: msFresh,
    });
  }

  if (lockedUntilRaw == null || String(lockedUntilRaw).trim() === "") {
    return res.status(400).json({
      error: "locked_until is not set; cannot resolve cooldown session.",
      manuscript: msBefore,
    });
  }

  const lockedUntilMs = new Date(String(lockedUntilRaw)).getTime();
  if (!Number.isFinite(lockedUntilMs)) {
    return res.status(400).json({ error: "Invalid locked_until on manuscript." });
  }

  if (Date.now() < lockedUntilMs) {
    return res.status(423).json({
      error: "Vault cooldown still active — locked_until is in the future.",
      locked_until: String(lockedUntilRaw),
      manuscript: msBefore,
    });
  }

  const { error: rpcErr } = await supabase.rpc("check_cooldown_expiry");
  if (rpcErr) {
    console.error("[manuscripts/unlock] check_cooldown_expiry", rpcErr.message);
    return res.status(500).json({ error: `check_cooldown_expiry: ${rpcErr.message}` });
  }

  const { data: msAfter, error: afterErr } = await supabase
    .from("p4_manuscripts")
    .select(MANUSCRIPT_UNLOCK_SELECT)
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  if (afterErr || !msAfter) {
    console.error("[manuscripts/unlock] post-rpc read", afterErr?.message);
    return res.status(500).json({ error: afterErr?.message ?? "Manuscript missing after cooldown RPC" });
  }

  const [revision_report, critic_sensitivity_text] = await Promise.all([
    resolveLibrarianRevisionReport(supabase, manuscriptId, lockedUntilRaw as string | null | undefined),
    latestCriticSensitivityText(supabase, manuscriptId),
  ]);

  const completedAt = new Date().toISOString();
  await supabase
    .from("p4_manuscripts")
    .update({ revisions_completed_at: completedAt, updated_at: completedAt })
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId);

  const continuity =
    revision_report &&
    revision_report.report_json &&
    typeof (revision_report.report_json as Record<string, unknown>).continuity_score === "number"
      ? Number((revision_report.report_json as Record<string, unknown>).continuity_score)
      : null;

  void postAuthorVerifyResult({
    passed: continuity == null || continuity >= 0.78,
    command: "author:revision:cooldown-unlock",
    actorId: user.userId,
    manuscriptId,
    surface: "revision_unlock",
    stdoutSnippet: `continuity=${continuity ?? "n/a"}; locked_until=${String(lockedUntilRaw)}`,
    stderrSnippet:
      continuity != null && continuity < 0.78
        ? `continuity_score ${continuity} below editor hub threshold 0.78`
        : undefined,
  });

  const { data: msFinal } = await supabase
    .from("p4_manuscripts")
    .select(MANUSCRIPT_UNLOCK_SELECT)
    .eq("id", manuscriptId)
    .eq("tenant_id", user.userId)
    .maybeSingle();

  return res.status(200).json({
    ok: true,
    revisions_completed_at: completedAt,
    revision_report,
    report_json: revision_report?.report_json ?? null,
    critic_sensitivity_text,
    manuscript: msFinal ?? msAfter,
    msgf_verify: {
      command: "author:revision:cooldown-unlock",
      continuity_score: continuity,
    },
  });
});
