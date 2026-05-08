/**
 * Author sovereignty: linguistic growth vs prior HAL sessions, human authorship certificates
 * from `p4_hal_ledger`, and revision cool-down locks with Librarian RAG continuity reports.
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { LinguisticSessionProfile } from "./forensics/linguistics.js";
import { LibrarianChat, type LibrarianAskResult, type LibrarianLanguage } from "./narrative/LibrarianChat.js";
import { latencyP90Ms } from "./halMetrics.js";

// ---------------------------------------------------------------------------
// Linguistic growth (TTR + sentence complexity)
// ---------------------------------------------------------------------------

/** Minimal session slice used for craft growth (from profiles or HAL snapshots). */
export type CraftGrowthSession = {
  ttr: number;
  /**
   * Composite sentence complexity: mean length amplified by length variability
   * (higher std dev ⇒ more syntactic variety within the session).
   */
  sentenceComplexity: number;
};

export type CraftGrowthResult = {
  previous: CraftGrowthSession;
  current: CraftGrowthSession;
  ttrDelta: number;
  sentenceComplexityDelta: number;
  /** Heuristic label from deltas (both axes non-negative ⇒ broad "growth"). */
  trajectory: "growth" | "mixed" | "contraction";
  summary: string;
};

/** Map a linguistic profile to a single complexity score (aligned with `LinguisticAnalyzer.extract`). */
export function sentenceComplexityFromProfile(p: LinguisticSessionProfile): number {
  const base = Math.max(0, p.avgSentenceLengthWords);
  const variability = Math.min(Math.max(p.sentenceLengthStdDev, 0), 24);
  return Math.round(base * (1 + variability * 0.07) * 1000) / 1000;
}

export function craftGrowthSessionFromProfile(p: LinguisticSessionProfile): CraftGrowthSession {
  return {
    ttr: Math.round(p.ttr * 10_000) / 10_000,
    sentenceComplexity: sentenceComplexityFromProfile(p),
  };
}

/**
 * Read TTR / sentence metrics from a HAL `stylometric_snapshot` JSON blob
 * (`linguistic_profile` as written by `hal.controller`).
 */
export function craftSessionFromStylometricSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): CraftGrowthSession | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const lp = snapshot["linguistic_profile"];
  if (!lp || typeof lp !== "object") return null;
  const o = lp as Record<string, unknown>;
  const ttr = Number(o["ttr"]);
  const avg = Number(o["avg_sentence_length_words"]);
  const std = Number(o["sentence_length_std_dev"]);
  const punct = Number(o["punctuation_frequency"]);
  const fn = Number(o["function_word_weight"]);
  if (!Number.isFinite(ttr) || !Number.isFinite(avg)) return null;
  const profile: LinguisticSessionProfile = {
    ttr,
    avgSentenceLengthWords: avg,
    punctuationFrequency: Number.isFinite(punct) ? punct : 0,
    functionWordWeight: Number.isFinite(fn) ? fn : 0,
    sentenceLengthStdDev: Number.isFinite(std) ? std : 0,
  };
  return craftGrowthSessionFromProfile(profile);
}

/**
 * Compare two sessions on TTR and sentence-complexity composite.
 * Pass profiles from `LinguisticAnalyzer`, HAL snapshots, or `craftGrowthSessionFromProfile`.
 */
export function calculateCraftGrowth(
  previousSession: CraftGrowthSession,
  currentSession: CraftGrowthSession
): CraftGrowthResult {
  const ttrDelta = Math.round((currentSession.ttr - previousSession.ttr) * 10_000) / 10_000;
  const sentenceComplexityDelta =
    Math.round((currentSession.sentenceComplexity - previousSession.sentenceComplexity) * 1000) / 1000;

  const ttrUp = ttrDelta >= 0;
  const cxUp = sentenceComplexityDelta >= 0;
  let trajectory: CraftGrowthResult["trajectory"];
  if (ttrUp && cxUp) trajectory = "growth";
  else if (!ttrUp && !cxUp) trajectory = "contraction";
  else trajectory = "mixed";

  const summary = [
    `TTR ${ttrDelta >= 0 ? "up" : "down"} ${Math.abs(ttrDelta)} vs prior session.`,
    `Sentence complexity ${sentenceComplexityDelta >= 0 ? "up" : "down"} ${Math.abs(
      sentenceComplexityDelta
    )} (length × variability index).`,
  ].join(" ");

  return {
    previous: previousSession,
    current: currentSession,
    ttrDelta,
    sentenceComplexityDelta,
    trajectory,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Human authorship certificate (p4_hal_ledger → JSON / PDF)
// ---------------------------------------------------------------------------

export type HalLatencyProof = {
  sampleCount: number;
  /** Millisecond inter-key (or rhythm-unit) latencies persisted on the ledger row. */
  samplesMs: number[];
  p90Ms: number;
  /** Optional raw stream from `raw_sample` when present. */
  rawKeystrokeLatencyMs?: number[];
};

export type HumanAuthorshipCertificateSession = {
  ledgerId: string;
  sessionId: string;
  createdAt: string;
  tenantId: string;
  authorUserId: string | null;
  manuscriptId: string | null;
  locale: string | null;
  manualWordCount: number | null;
  latencyProof: HalLatencyProof;
  halScoreFinal: number | null;
  typingScore: number | null;
  isImeSession: boolean | null;
};

export type HumanAuthorshipCertificate = {
  schema: "human_authorship_certificate.v1";
  issuedAt: string;
  tenantId: string;
  sessionCount: number;
  /** Narrative + cryptographic-light integrity note (deterministic hash of canonical JSON). */
  contentSha256: string;
  sessions: HumanAuthorshipCertificateSession[];
};

export type P4HalLedgerCertificateRow = {
  id: string;
  tenant_id: string;
  author_user_id: string | null;
  session_id: string;
  keystroke_latency_ms: number[] | null;
  manual_word_count: number | null;
  stylometric_snapshot: Record<string, unknown> | null;
  raw_sample: Record<string, unknown> | null;
  created_at: string;
};

function sha256HexUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function latencySamplesFromRow(row: P4HalLedgerCertificateRow): number[] {
  const primary = Array.isArray(row.keystroke_latency_ms) ? row.keystroke_latency_ms : [];
  const raw = row.raw_sample;
  const rawArr =
    raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>)["raw_keystroke_latency_ms"])
      ? ((raw as Record<string, unknown>)["raw_keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
      : [];
  const merged = primary.length > 0 ? primary : rawArr.filter((n) => Number.isFinite(n));
  return merged.filter((n) => Number.isFinite(n)) as number[];
}

function sessionFromLedgerRow(row: P4HalLedgerCertificateRow): HumanAuthorshipCertificateSession {
  const snap = row.stylometric_snapshot ?? null;
  const raw = row.raw_sample ?? null;
  const samplesMs = latencySamplesFromRow(row);
  const manuscriptId =
    raw && typeof raw === "object" && typeof (raw as Record<string, unknown>)["manuscriptId"] === "string"
      ? String((raw as Record<string, unknown>)["manuscriptId"])
      : null;
  const locale =
    snap && typeof snap === "object" && typeof (snap as Record<string, unknown>)["locale"] === "string"
      ? String((snap as Record<string, unknown>)["locale"])
      : null;
  const halScoreFinal =
    snap && typeof snap === "object" && (snap as Record<string, unknown>)["hal_score_final"] != null
      ? Number((snap as Record<string, unknown>)["hal_score_final"])
      : null;
  const typingScore =
    snap && typeof snap === "object" && (snap as Record<string, unknown>)["typing_score"] != null
      ? Number((snap as Record<string, unknown>)["typing_score"])
      : null;
  const isImeSession =
    snap && typeof snap === "object" && typeof (snap as Record<string, unknown>)["is_ime_session"] === "boolean"
      ? Boolean((snap as Record<string, unknown>)["is_ime_session"])
      : null;

  const rawKeystroke =
    raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>)["raw_keystroke_latency_ms"])
      ? ((raw as Record<string, unknown>)["raw_keystroke_latency_ms"] as number[])
      : undefined;

  return {
    ledgerId: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    tenantId: row.tenant_id,
    authorUserId: row.author_user_id,
    manuscriptId,
    locale,
    manualWordCount: row.manual_word_count,
    latencyProof: {
      sampleCount: samplesMs.length,
      samplesMs,
      p90Ms: latencyP90Ms(samplesMs),
      rawKeystrokeLatencyMs: rawKeystroke,
    },
    halScoreFinal: Number.isFinite(halScoreFinal) ? halScoreFinal : null,
    typingScore: Number.isFinite(typingScore) ? typingScore : null,
    isImeSession,
  };
}

/**
 * Build a portable certificate object from HAL ledger rows (ms latency proof per session).
 */
export function buildHumanAuthorshipCertificate(
  tenantId: string,
  rows: P4HalLedgerCertificateRow[]
): HumanAuthorshipCertificate {
  const sessions = rows.map(sessionFromLedgerRow);
  const canonical = JSON.stringify({
    tenantId,
    sessions: sessions.map((s) => ({
      ledgerId: s.ledgerId,
      sessionId: s.sessionId,
      createdAt: s.createdAt,
      latencyProof: s.latencyProof,
    })),
  });
  const contentSha256 = sha256HexUtf8(canonical);
  return {
    schema: "human_authorship_certificate.v1",
    issuedAt: new Date().toISOString(),
    tenantId,
    sessionCount: sessions.length,
    contentSha256,
    sessions,
  };
}

export function exportHumanAuthorshipCertificateJson(cert: HumanAuthorshipCertificate): string {
  return JSON.stringify(cert, null, 2);
}

/** One-page PDF summary (ASCII); full proof remains in JSON). */
export async function exportHumanAuthorshipCertificatePdf(
  cert: HumanAuthorshipCertificate
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 740;
  const left = 48;
  const line = (text: string, size = 10, f = font, color = rgb(0.15, 0.15, 0.18)) => {
    page.drawText(text.slice(0, 92), { x: left, y, size, font: f, color });
    y -= size + 4;
  };

  page.drawText("Human Authorship Certificate", {
    x: left,
    y,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.35, 0.22),
  });
  y -= 28;
  line(`Schema: ${cert.schema}`);
  line(`Issued: ${cert.issuedAt}`);
  line(`Tenant: ${cert.tenantId}`);
  line(`Sessions: ${cert.sessionCount}`);
  line(`Content SHA-256: ${cert.contentSha256}`);
  y -= 8;
  line("Millisecond latency proof (per ledger row):", 11, bold);

  for (const s of cert.sessions.slice(0, 8)) {
    if (y < 120) break;
    const head = `${s.createdAt} | ledger=${s.ledgerId.slice(0, 8)}… | n=${s.latencyProof.sampleCount} | p90=${s.latencyProof.p90Ms}ms`;
    line(head, 9, bold, rgb(0.1, 0.2, 0.45));
    const preview = s.latencyProof.samplesMs.slice(0, 24).join(", ");
    line(`samples_ms: ${preview}${s.latencyProof.samplesMs.length > 24 ? " …" : ""}`, 8);
    y -= 2;
  }
  if (cert.sessions.length > 8) {
    line(`… ${cert.sessions.length - 8} additional session(s) omitted here; see JSON export.`, 9);
  }

  page.drawText(
    "Full latency arrays and stylometric snapshots are included in the JSON certificate.",
    {
      x: left,
      y: 72,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.38),
    }
  );

  return doc.save();
}

// ---------------------------------------------------------------------------
// Revision hub — cool-down lock + Librarian continuity gap report
// ---------------------------------------------------------------------------

export type RevisionCooldownLockRecord = {
  tenantId: string;
  manuscriptId: string;
  /** Epoch ms — edits must be blocked while `Date.now() < lockExpiryMs`. */
  lockExpiryMs: number;
  lockedText: string;
  startedAt: string;
  continuityGapReport: LibrarianAskResult;
};

export class CooldownLockError extends Error {
  readonly code = "COOLDOWN_LOCK_ACTIVE" as const;
  readonly lockExpiryIso: string;
  readonly tenantId: string;
  readonly manuscriptId: string;

  constructor(args: { tenantId: string; manuscriptId: string; lockExpiryMs: number; message?: string }) {
    super(
      args.message ??
        `Edits are blocked until cool-down expires (${new Date(args.lockExpiryMs).toISOString()}).`
    );
    this.name = "CooldownLockError";
    this.tenantId = args.tenantId;
    this.manuscriptId = args.manuscriptId;
    this.lockExpiryIso = new Date(args.lockExpiryMs).toISOString();
  }
}

function lockKey(tenantId: string, manuscriptId: string): string {
  return `${tenantId}::${manuscriptId}`;
}

function buildContinuityGapQuestion(lockedText: string): string {
  const excerpt = lockedText.trim().slice(0, 12_000);
  return [
    "Revision Hub — Continuity Gap Report (cool-down review).",
    "The following passage is LOCKED as the author's last committed human segment.",
    "Using Lore Librarian RAG over canon context, list continuity risks: timelines, character facts,",
    "unresolved callbacks, world rules, and anything an editor must verify before revising.",
    "Use Canon: bullets only for facts grounded in retrieved context; Scientific Inference: for",
    "hypotheses. If context is insufficient, say so under Canon:.",
    "",
    "---LOCKED_SEGMENT---",
    excerpt,
    "---END_LOCKED_SEGMENT---",
  ].join("\n");
}

/**
 * Service-role Supabase + optional in-memory cool-down locks (replace with DB if you need HA).
 */
export class AuthorSovereigntyService {
  private readonly locks = new Map<string, RevisionCooldownLockRecord>();

  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Fetch recent `p4_hal_ledger` rows for a tenant (service role).
   */
  async fetchHalLedgerForCertificate(
    tenantId: string,
    options?: { limit?: number }
  ): Promise<P4HalLedgerCertificateRow[]> {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const { data, error } = await this.supabase
      .from("p4_hal_ledger")
      .select(
        "id, tenant_id, author_user_id, session_id, keystroke_latency_ms, manual_word_count, stylometric_snapshot, raw_sample, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`fetchHalLedgerForCertificate: ${error.message}`);
    return (data ?? []) as P4HalLedgerCertificateRow[];
  }

  async buildCertificateForTenant(
    tenantId: string,
    options?: { limit?: number }
  ): Promise<HumanAuthorshipCertificate> {
    const rows = await this.fetchHalLedgerForCertificate(tenantId, options);
    return buildHumanAuthorshipCertificate(tenantId, rows);
  }

  /**
   * Apply a cool-down lock: freeze `lockedText`, run Librarian RAG for a Continuity Gap Report,
   * and reject edits until `lock_expiry`.
   */
  async beginRevisionCooldownLock(input: {
    tenantId: string;
    manuscriptId: string;
    lockedText: string;
    /** Wall-clock duration for the lock (default 15 minutes). */
    cooldownMs?: number;
    librarianLanguage?: LibrarianLanguage;
    /** Optional `LibrarianChat` factory for tests. */
    createLibrarian?: (client: SupabaseClient) => LibrarianChat;
  }): Promise<{ lock_expiry: string; lock: RevisionCooldownLockRecord }> {
    const cooldownMs = input.cooldownMs ?? 15 * 60 * 1000;
    const lockExpiryMs = Date.now() + cooldownMs;
    const chat = input.createLibrarian?.(this.supabase) ?? new LibrarianChat(this.supabase);
    const continuityGapReport = await chat.ask({
      tenantId: input.tenantId,
      question: buildContinuityGapQuestion(input.lockedText),
      audience: "author",
      enforceMode: "strip",
      language: input.librarianLanguage ?? "en",
    });

    const record: RevisionCooldownLockRecord = {
      tenantId: input.tenantId,
      manuscriptId: input.manuscriptId,
      lockExpiryMs,
      lockedText: input.lockedText,
      startedAt: new Date().toISOString(),
      continuityGapReport,
    };
    this.locks.set(lockKey(input.tenantId, input.manuscriptId), record);

    return {
      lock_expiry: new Date(lockExpiryMs).toISOString(),
      lock: record,
    };
  }

  getCooldownLock(tenantId: string, manuscriptId: string): RevisionCooldownLockRecord | null {
    const row = this.locks.get(lockKey(tenantId, manuscriptId)) ?? null;
    if (!row) return null;
    if (Date.now() >= row.lockExpiryMs) {
      this.locks.delete(lockKey(tenantId, manuscriptId));
      return null;
    }
    return row;
  }

  /**
   * Throws `CooldownLockError` when a cool-down lock is active (blocks all edits).
   */
  assertEditsAllowed(tenantId: string, manuscriptId: string): void {
    const row = this.locks.get(lockKey(tenantId, manuscriptId));
    if (!row) return;
    if (Date.now() >= row.lockExpiryMs) {
      this.locks.delete(lockKey(tenantId, manuscriptId));
      return;
    }
    throw new CooldownLockError({
      tenantId,
      manuscriptId,
      lockExpiryMs: row.lockExpiryMs,
    });
  }

  /** Milliseconds remaining for an active lock, or `0` if none / expired. */
  msUntilCooldownUnlock(tenantId: string, manuscriptId: string): number {
    const row = this.locks.get(lockKey(tenantId, manuscriptId));
    if (!row) return 0;
    const left = row.lockExpiryMs - Date.now();
    if (left <= 0) {
      this.locks.delete(lockKey(tenantId, manuscriptId));
      return 0;
    }
    return left;
  }
}
