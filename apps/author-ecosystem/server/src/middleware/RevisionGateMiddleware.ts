/**
 * P3 Revision gate — bridges MSGF Apprentice/Guild tier awareness with BFF planning sync cooldown
 * and gated Librarian revision reports (semantic audit + narrative digest).
 *
 * - Rapid repeat `POST /api/projects/:id/sync-session` (within 24h) for tiered authors sets
 *   `p4_manuscripts.revision_status = COOLDOWN_LOCKED` and `revision_cooldown_until`, then schedules
 *   Librarian (Logic) JSON audit (`revision_reports`) vs RAG World Bible / Outline.
 * - `POST /api/revision-gate/revision-report` runs the vector audit only after cooldown expiry,
 *   runs the Critic (Sensitivity) manuscript pass in parallel with the Librarian, then appends the Critic's Summary
 *   to the combined revision report (`librarian_report.answer`).
 * - Compliance: inserts `p4_hal_ledger` rows tagged `p3_revision_gate` for cooldown transitions and audit runs.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Router, type Request, type Response } from "express";

import { assertBffManuscriptTenantSession, resolveApprenticeOrGuildTier } from "./author-gate.js";
import { P4_HAL_LEDGER } from "../lib/database/canonicalIdentifiers.js";
import { assertUuid, HalValidationError } from "../lib/halMetrics.js";
import { LibrarianChat } from "../lib/narrative/LibrarianChat.js";
import {
  runCriticsRevisionPassAndPersist,
  scheduleLibrarianLogicRevisionAuditOnCooldown,
} from "../lib/RevisionAuditService.js";
import { triggerRevisionAudit, type RevisionAuditResult } from "../lib/RevisionLockService.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Manuscript rows include revision gate columns after migration `20260516700000_p4_revision_gate_cooldown`. */
export type RevisionGateManuscriptRow = {
  id: string;
  tenant_id: string;
  revision_status: string;
  planning_last_synced_at: string | null;
  revision_cooldown_until: string | null;
};

const TERMINAL_LOCK_STATUSES = new Set(["LOCKED", "AUDITING"]);

export const revisionGateRouter = Router();

export type PlanningSyncCooldownResult = {
  tier_kinds: string[];
  cooldown_applied: boolean;
  planning_last_synced_at: string | null;
  revision_cooldown_until: string | null;
  revision_status: string;
};

export async function insertP3RevisionGateHalEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    authorUserId: string | null;
    manuscriptId: string;
    event: string;
    payload: Record<string, unknown>;
  }
): Promise<{ id: string; created_at: string }> {
  const sessionId = randomUUID();
  const raw_sample = {
    p3_revision_gate: true as const,
    event: input.event,
    manuscript_id: input.manuscriptId,
    ...input.payload,
  };
  const stylometric_snapshot = {
    p3_revision_gate: true as const,
    event: input.event,
  };

  const { data, error } = await supabase
    .from(P4_HAL_LEDGER)
    .insert({
      tenant_id: input.tenantId,
      author_user_id: input.authorUserId,
      session_id: sessionId,
      keystroke_latency_ms: [],
      manual_word_count: 0,
      ai_assisted_word_count: 0,
      stylometric_snapshot,
      raw_sample,
    })
    .select("id, created_at")
    .single();

  if (error) throw new Error(`p3_revision_gate HAL insert: ${error.message}`);
  return { id: data.id as string, created_at: data.created_at as string };
}

/**
 * If cooldown window elapsed, clear `COOLDOWN_LOCKED` back to `DRAFTING` (idempotent).
 */
export async function maybeReleaseExpiredCooldown(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<RevisionGateManuscriptRow | null> {
  const { data: row, error } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, revision_status, planning_last_synced_at, revision_cooldown_until")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (error) throw new Error(`revision gate read: ${error.message}`);
  if (!row) return null;

  const r = row as RevisionGateManuscriptRow;
  if (r.revision_status !== "COOLDOWN_LOCKED") return r;

  const now = Date.now();
  const until = r.revision_cooldown_until ? new Date(r.revision_cooldown_until).getTime() : null;
  const fallbackUntil = r.planning_last_synced_at
    ? new Date(r.planning_last_synced_at).getTime() + COOLDOWN_MS
    : null;
  const effectiveUntil = until ?? fallbackUntil;
  if (effectiveUntil != null && now < effectiveUntil) return r;

  const { data: next, error: upErr } = await supabase
    .from("p4_manuscripts")
    .update({
      revision_status: "DRAFTING",
      revision_cooldown_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", manuscriptId)
    .select("id, tenant_id, revision_status, planning_last_synced_at, revision_cooldown_until")
    .single();

  if (upErr) throw new Error(`revision gate release: ${upErr.message}`);
  return next as RevisionGateManuscriptRow;
}

/**
 * After a substantive planning sync: Apprentice/Guild authors who re-sync within 24h enter `COOLDOWN_LOCKED`.
 * Does not override `LOCKED` / `AUDITING` lifecycle states.
 */
export async function applyPlanningSyncRevisionGate(
  supabase: SupabaseClient,
  input: {
    userId: string;
    tenantId: string;
    manuscriptId: string;
    anyWork: boolean;
  }
): Promise<PlanningSyncCooldownResult> {
  if (!input.anyWork) {
    const { data: cur } = await supabase
      .from("p4_manuscripts")
      .select("revision_status, planning_last_synced_at, revision_cooldown_until")
      .eq("id", input.manuscriptId)
      .maybeSingle();
    const r = (cur ?? {}) as Partial<RevisionGateManuscriptRow>;
    return {
      tier_kinds: [],
      cooldown_applied: false,
      planning_last_synced_at: r.planning_last_synced_at ?? null,
      revision_cooldown_until: r.revision_cooldown_until ?? null,
      revision_status: String(r.revision_status ?? "DRAFTING"),
    };
  }

  const tier = await resolveApprenticeOrGuildTier(supabase, {
    tenantId: input.tenantId,
    userId: input.userId,
    manuscriptId: input.manuscriptId,
  });

  if (tier.ok) {
    await maybeReleaseExpiredCooldown(supabase, input.manuscriptId);
  }

  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, revision_status, planning_last_synced_at, revision_cooldown_until")
    .eq("id", input.manuscriptId)
    .maybeSingle();

  if (msErr) throw new Error(`applyPlanningSyncRevisionGate: ${msErr.message}`);
  if (!ms) throw new Error("Manuscript not found");

  const row = ms as RevisionGateManuscriptRow;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  let cooldownApplied = false;
  let nextStatus = row.revision_status;
  let nextCooldownUntil = row.revision_cooldown_until;

  const tierKinds = tier.ok ? tier.kinds : [];

  if (tier.ok && !TERMINAL_LOCK_STATUSES.has(row.revision_status)) {
    const last = row.planning_last_synced_at ? new Date(row.planning_last_synced_at).getTime() : null;
    if (last != null && nowMs - last < COOLDOWN_MS) {
      nextStatus = "COOLDOWN_LOCKED";
      nextCooldownUntil = new Date(nowMs + COOLDOWN_MS).toISOString();
      cooldownApplied = true;
    }
  }

  if (!tier.ok) {
    const { data: updated, error: upErr } = await supabase
      .from("p4_manuscripts")
      .update({
        planning_last_synced_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", input.manuscriptId)
      .select("revision_status, planning_last_synced_at, revision_cooldown_until")
      .single();
    if (upErr) throw new Error(`applyPlanningSyncRevisionGate update: ${upErr.message}`);
    const u = updated as {
      revision_status: string;
      planning_last_synced_at: string | null;
      revision_cooldown_until: string | null;
    };
    return {
      tier_kinds: [],
      cooldown_applied: false,
      planning_last_synced_at: u.planning_last_synced_at,
      revision_cooldown_until: u.revision_cooldown_until,
      revision_status: u.revision_status,
    };
  }

  const { data: updated, error: upErr } = await supabase
    .from("p4_manuscripts")
    .update({
      planning_last_synced_at: nowIso,
      revision_status: nextStatus,
      revision_cooldown_until: nextCooldownUntil,
      updated_at: nowIso,
    })
    .eq("id", input.manuscriptId)
    .select("revision_status, planning_last_synced_at, revision_cooldown_until")
    .single();

  if (upErr) throw new Error(`applyPlanningSyncRevisionGate update: ${upErr.message}`);

  const u = updated as {
    revision_status: string;
    planning_last_synced_at: string | null;
    revision_cooldown_until: string | null;
  };

  if (cooldownApplied) {
    try {
      let authorUserId: string | null = null;
      try {
        authorUserId = assertUuid(input.userId, "author_user_id");
      } catch {
        authorUserId = null;
      }
      await insertP3RevisionGateHalEvent(supabase, {
        tenantId: input.tenantId,
        authorUserId,
        manuscriptId: input.manuscriptId,
        event: "REVISION_GATE_COOLDOWN_APPLIED",
        payload: {
          tier_kinds: tierKinds,
          previous_planning_last_synced_at: row.planning_last_synced_at,
          revision_cooldown_until: nextCooldownUntil,
        },
      });
    } catch (e) {
      console.error("[revision-gate] HAL log (cooldown) failed", e);
    }

    const sessionEnd = u.revision_cooldown_until ?? nextCooldownUntil;
    if (sessionEnd) {
      scheduleLibrarianLogicRevisionAuditOnCooldown({
        supabase,
        manuscriptId: input.manuscriptId,
        tenantId: input.tenantId,
        userIdForLegacyRag: input.userId,
        lockedUntilSession: sessionEnd,
      });
    }
  }

  return {
    tier_kinds: tierKinds,
    cooldown_applied: cooldownApplied,
    planning_last_synced_at: u.planning_last_synced_at,
    revision_cooldown_until: u.revision_cooldown_until,
    revision_status: u.revision_status,
  };
}

export class RevisionGateBlockedError extends Error {
  readonly code: "REVISION_GATE_COOLDOWN" | "REVISION_TIER_LOCK";
  constructor(
    message: string,
    readonly revision_cooldown_until: string | null,
    code: "REVISION_GATE_COOLDOWN" | "REVISION_TIER_LOCK" = "REVISION_GATE_COOLDOWN"
  ) {
    super(message);
    this.name = "RevisionGateBlockedError";
    this.code = code;
  }
}

/**
 * Ensures manuscript is eligible for revision audit (cooldown cleared). Mutates row to DRAFTING when expired.
 */
export async function assertRevisionReportAllowed(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<RevisionGateManuscriptRow> {
  const released = await maybeReleaseExpiredCooldown(supabase, manuscriptId);
  if (!released) throw new Error("Manuscript not found");

  if (released.revision_status === "COOLDOWN_LOCKED") {
    const until = released.revision_cooldown_until ?? released.planning_last_synced_at;
    throw new RevisionGateBlockedError(
      "Revision report blocked — P3 cooldown active after rapid planning sync. Retry after cooldown.",
      until,
      "REVISION_GATE_COOLDOWN"
    );
  }

  if (released.revision_status === "LOCKED") {
    const { data: lockRow } = await supabase
      .from("p4_manuscripts")
      .select("lock_expires_at")
      .eq("id", manuscriptId)
      .maybeSingle();
    const exp = (lockRow as { lock_expires_at?: string | null } | null)?.lock_expires_at ?? null;
    const now = Date.now();
    if (exp && now < new Date(exp).getTime()) {
      throw new RevisionGateBlockedError(
        `Revision report blocked — tier revision LOCKED until ${exp}.`,
        exp,
        "REVISION_TIER_LOCK"
      );
    }
  }

  return released;
}

async function fetchLatestAuditSummary(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("p4_revision_reports")
    .select("details, created_at")
    .eq("manuscript_id", manuscriptId)
    .eq("finding_type", "AUDIT_SUMMARY")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[revision-gate] audit summary read", error.message);
    return null;
  }
  if (!data) return null;
  return (data as { details?: Record<string, unknown> }).details ?? null;
}

/**
 * Runs `triggerRevisionAudit` (manuscript vs wiki_snapshot lore vectors), parallel **Critic (Sensitivity)**
 * pass on the same manuscript snapshot, Librarian narrative report, then appends the Critic's Summary.
 */
export async function runGatedRevisionReport(
  supabase: SupabaseClient,
  input: { tenantId: string; userId: string; manuscriptId: string }
): Promise<{
  audit: RevisionAuditResult;
  librarian_report: { answer: string; detectedLanguage?: string };
  critic_summary: string;
  critic_summary_meta: { persisted: boolean; skipped_reason?: string };
  hal_ledger_id: string | null;
}> {
  const row = await assertRevisionReportAllowed(supabase, input.manuscriptId);

  const tier = await resolveApprenticeOrGuildTier(supabase, {
    tenantId: input.tenantId,
    userId: input.userId,
    manuscriptId: input.manuscriptId,
  });
  if (!tier.ok) {
    throw new Error(`Revision gate tier: ${tier.reason}`);
  }

  let halLedgerId: string | null = null;
  try {
    let authorUserId: string | null = null;
    try {
      authorUserId = assertUuid(input.userId, "author_user_id");
    } catch {
      authorUserId = null;
    }
    const inserted = await insertP3RevisionGateHalEvent(supabase, {
      tenantId: input.tenantId,
      authorUserId,
      manuscriptId: input.manuscriptId,
      event: "REVISION_REPORT_STARTED",
      payload: {
        tier_kinds: tier.kinds,
        prior_revision_status: row.revision_status,
      },
    });
    halLedgerId = inserted.id;
  } catch (e) {
    console.error("[revision-gate] HAL log (audit start) failed", e);
  }

  const audit = await triggerRevisionAudit(supabase, input.manuscriptId);
  const summary = await fetchLatestAuditSummary(supabase, input.manuscriptId);

  const question = [
    "You are the Revision Librarian producing a formal **Revision Report** after a P3 revision gate cooldown cleared.",
    "Ground every claim in the JSON audit summary below (vector audit: manuscript vs wiki_snapshot lore / plot chunks).",
    "Explicitly contrast: (A) recent HAL-led drafting sessions as the human typing ledger signal, vs (B) finalized wiki_snapshot lore the audit compared.",
    "Deliver: (1) Executive summary, (2) Canon / manuscript alignment risks, (3) Recommended next edits before editor handoff.",
    "A separate **Critic (Sensitivity)** module will append market/theme/genre-tone commentary after your report; do not duplicate that lens here.",
    "",
    "Audit summary JSON:",
    JSON.stringify(summary ?? { note: "summary unavailable" }),
  ].join("\n");

  const chat = new LibrarianChat(supabase);
  const [lr, criticPass] = await Promise.all([
    chat.ask({
      tenantId: input.tenantId,
      question,
      audience: "author",
      enforceMode: "strip",
      tenantScope: "author",
    }),
    runCriticsRevisionPassAndPersist(supabase, input.manuscriptId),
  ]);

  const criticBlock =
    criticPass.text.trim().length > 0
      ? `\n\n---\n\n## Critic's Summary (Sensitivity)\n\n${criticPass.text.trim()}`
      : criticPass.skippedReason
        ? `\n\n---\n\n## Critic's Summary (Sensitivity)\n\n(${criticPass.skippedReason})`
        : "";

  const combinedAnswer = `${lr.answer.trim()}${criticBlock}`;

  try {
    let authorUserId: string | null = null;
    try {
      authorUserId = assertUuid(input.userId, "author_user_id");
    } catch {
      authorUserId = null;
    }
    await insertP3RevisionGateHalEvent(supabase, {
      tenantId: input.tenantId,
      authorUserId,
      manuscriptId: input.manuscriptId,
      event: "REVISION_REPORT_COMPLETE",
      payload: {
        tier_kinds: tier.kinds,
        audit_score: audit.auditScore,
        gap_findings: audit.gapFindings,
        tension_findings: audit.tensionFindings,
        critic_summary_persisted: criticPass.persisted,
        critic_summary_chars: criticPass.text.length,
      },
    });
  } catch (e) {
    console.error("[revision-gate] HAL log (audit complete) failed", e);
  }

  return {
    audit,
    librarian_report: { answer: combinedAnswer, detectedLanguage: lr.detectedLanguage },
    critic_summary: criticPass.text,
    critic_summary_meta: {
      persisted: criticPass.persisted,
      ...(criticPass.skippedReason ? { skipped_reason: criticPass.skippedReason } : {}),
    },
    hal_ledger_id: halLedgerId,
  };
}

/**
 * POST /api/revision-gate/revision-report
 * Body: { manuscript_id, tenant_id }
 */
revisionGateRouter.post("/api/revision-gate/revision-report", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  try {
    const body = req.body as Record<string, unknown>;
    const manuscriptId = assertUuid(String(body.manuscript_id ?? ""), "manuscript_id");
    const tenantId = assertUuid(String(body.tenant_id ?? ""), "tenant_id");

    const supabase = getSupabaseAdmin();
    const sess = await assertBffManuscriptTenantSession(supabase, { manuscriptId, tenantId });
    if (!sess.ok) {
      const status = /not found/i.test(sess.reason) ? 404 : 403;
      return res.status(status).json({ error: sess.reason });
    }

    const result = await runGatedRevisionReport(supabase, {
      tenantId,
      userId: user.userId,
      manuscriptId,
    });

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (e) {
    if (e instanceof RevisionGateBlockedError) {
      const status = e.code === "REVISION_TIER_LOCK" ? 409 : 423;
      return res.status(status).json({
        error: e.message,
        code: e.code,
        revision_cooldown_until: e.revision_cooldown_until,
      });
    }
    if (e instanceof HalValidationError) {
      return res.status(400).json({ error: e.message });
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/empty|LOCKED|cooldown/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    console.error("[revision-gate/revision-report]", e);
    return res.status(500).json({ error: msg });
  }
});
