/**
 * Gatekeeper for "Request Editor Assignment" and editor-safe previews (no manuscript body until match).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthorSovereigntyService } from "./AuthorSovereigntyService.js";
import type { HumanAuthorshipCertificate } from "./AuthorSovereigntyService.js";

/** Minimum `p4_manuscripts.revision_count` before editor hub unlocks (inclusive). */
export const MIN_MANUSCRIPT_REVISION_COUNT_FOR_EDITOR = 2;

/** Minimum `report_json.continuity_score` on the **latest** `p4_revision_reports` row (inclusive, [0,1]). */
export const MIN_LATEST_REVISION_REPORT_CONTINUITY_SCORE = 0.78;

/** Shown when the editor-request control is disabled (matches server gate). */
export const EDITOR_HUB_QUALITY_REQUIREMENTS_TOOLTIP =
  "Editor hub unlock requires: (1) p4_manuscripts.revision_count >= 2, and (2) the latest p4_revision_reports row must have report_json.continuity_score >= 0.78.";

export type ManuscriptQualityVerification = {
  /** True only when `revision_count >= 2` and latest `p4_revision_reports.report_json.continuity_score >= 0.78`. */
  verified: boolean;
  revision_count: number;
  revision_status: string;
  manuscript_audit_score: number;
  /** From the latest `p4_revision_reports` row by `created_at` (desc). */
  continuity_score: number | null;
  checks: {
    revisions_ok: boolean;
    continuity_verified: boolean;
  };
  author_progress: string;
  reason: string;
};

export type EditorRequestGate = ManuscriptQualityVerification & {
  /** Same as {@link ManuscriptQualityVerification.verified}. */
  allowed: boolean;
};

export type EditorPendingAssignmentView = {
  manuscript_id: string;
  tenant_id: string;
  title: string | null;
  /** Manuscript prose is never returned here — UI should blur/redact until the author accepts the match. */
  manuscript_body_hidden: true;
  /** Copy for editors explaining visibility rules. */
  visibility_notice: string;
  /** Manuscript-level counts from `p4_revision_reports`. */
  revision_metrics: {
    lore_breaches: number;
    complexity_signals: number;
  };
  audit_queue_results: Array<{
    id: string;
    status: string;
    completed_at: string | null;
    /** Truncated Librarian answer from `comprehensive_report`, when present. */
    comprehensive_report_excerpt: string | null;
  }>;
  /** Lore breaches + tension rows from `p4_revision_reports`. */
  revision_audit_findings: Array<{
    id: string;
    finding_type: string;
    severity: string;
    created_at: string;
    details_summary: string;
  }>;
  /** Redacted human-ledger certificate (latency counts / hashes only — no full ms arrays). */
  human_ledger_certificate_preview: {
    schema: string;
    issuedAt: string;
    sessionCount: number;
    contentSha256: string;
    sessions_summary: Array<{
      ledgerId: string;
      createdAt: string;
      p90Ms: number;
      sampleCount: number;
      halScoreFinal: number | null;
    }>;
  };
};

export class EditorRequestDeniedError extends Error {
  readonly code = "EDITOR_REQUEST_DENIED" as const;

  constructor(message: string) {
    super(message);
    this.name = "EditorRequestDeniedError";
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function continuityFromReportJson(reportJson: unknown): number | null {
  if (!reportJson || typeof reportJson !== "object") return null;
  const cs = (reportJson as Record<string, unknown>)["continuity_score"];
  if (typeof cs !== "number" || !Number.isFinite(cs)) return null;
  return clamp01(cs);
}

function formatAuthorProgress(revisionCount: number, continuity01: number | null): string {
  const thr = Math.round(MIN_LATEST_REVISION_REPORT_CONTINUITY_SCORE * 100);
  const cont =
    continuity01 != null && Number.isFinite(continuity01) ? `${Math.round(continuity01 * 100)}%` : "—";
  return `Continuity score (latest report): ${cont} / ${thr}% | Revision passes: ${revisionCount} / ${MIN_MANUSCRIPT_REVISION_COUNT_FOR_EDITOR}`;
}

/**
 * Editor-hub manuscript quality gate: `revision_count >= 2` and latest `p4_revision_reports`
 * has `report_json.continuity_score >= {@link MIN_LATEST_REVISION_REPORT_CONTINUITY_SCORE}`.
 */
export async function evaluateManuscriptQualityForEditorHub(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<ManuscriptQualityVerification> {
  const { data: ms, error } = await supabase
    .from("p4_manuscripts")
    .select("revision_count, revision_status, audit_score")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (error) {
    throw new Error(`evaluateManuscriptQualityForEditorHub: ${error.message}`);
  }
  if (!ms) {
    return {
      verified: false,
      revision_count: 0,
      revision_status: "",
      manuscript_audit_score: 0,
      continuity_score: null,
      checks: { revisions_ok: false, continuity_verified: false },
      author_progress: formatAuthorProgress(0, null),
      reason: "Manuscript not found.",
    };
  }

  const row = ms as Record<string, unknown>;
  const revision_count = Number(row["revision_count"] ?? 0);
  const revision_status = String(row["revision_status"] ?? "");
  const manuscript_audit_score = Number(row["audit_score"] ?? 0);

  const { data: latest, error: lrErr } = await supabase
    .from("p4_revision_reports")
    .select("report_json")
    .eq("manuscript_id", manuscriptId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lrErr) {
    throw new Error(`p4_revision_reports latest: ${lrErr.message}`);
  }

  const continuity_score = continuityFromReportJson(
    latest ? (latest as { report_json?: unknown }).report_json : null
  );

  const revisions_ok = revision_count >= MIN_MANUSCRIPT_REVISION_COUNT_FOR_EDITOR;
  const continuity_verified =
    continuity_score != null && continuity_score >= MIN_LATEST_REVISION_REPORT_CONTINUITY_SCORE;
  const verified = revisions_ok && continuity_verified;

  const author_progress = formatAuthorProgress(revision_count, continuity_score);

  const parts: string[] = [];
  if (!revisions_ok) {
    parts.push(
      `Need p4_manuscripts.revision_count >= ${MIN_MANUSCRIPT_REVISION_COUNT_FOR_EDITOR} (currently ${revision_count}).`
    );
  }
  if (!continuity_verified) {
    parts.push(
      `Latest p4_revision_reports row must have report_json.continuity_score >= ${MIN_LATEST_REVISION_REPORT_CONTINUITY_SCORE} (latest: ${
        continuity_score == null ? "missing" : continuity_score.toFixed(3)
      }).`
    );
  }

  const reason = verified
    ? "Manuscript quality verified for editor hub."
    : `${author_progress}. ${parts.join(" ")}`.trim();

  return {
    verified,
    revision_count,
    revision_status,
    manuscript_audit_score,
    continuity_score,
    checks: { revisions_ok, continuity_verified },
    author_progress,
    reason,
  };
}

/** Returns true only when {@link evaluateManuscriptQualityForEditorHub} reports `verified`. */
export async function isManuscriptQualityVerified(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<boolean> {
  const r = await evaluateManuscriptQualityForEditorHub(supabase, manuscriptId);
  return r.verified;
}

function certificatePreviewFromFull(cert: HumanAuthorshipCertificate): EditorPendingAssignmentView["human_ledger_certificate_preview"] {
  return {
    schema: cert.schema,
    issuedAt: cert.issuedAt,
    sessionCount: cert.sessionCount,
    contentSha256: cert.contentSha256,
    sessions_summary: cert.sessions.map((s) => ({
      ledgerId: s.ledgerId,
      createdAt: s.createdAt,
      p90Ms: s.latencyProof.p90Ms,
      sampleCount: s.latencyProof.sampleCount,
      halScoreFinal: s.halScoreFinal,
    })),
  };
}

function excerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export class EditorRequestService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Gatekeeper: editor assignment only when {@link isManuscriptQualityVerified} is satisfied
   * (revision count + latest revision report continuity score).
   */
  async evaluateEditorRequest(manuscriptId: string): Promise<EditorRequestGate> {
    const q = await evaluateManuscriptQualityForEditorHub(this.supabase, manuscriptId);
    return { ...q, allowed: q.verified };
  }

  async assertMayRequestEditor(manuscriptId: string): Promise<EditorRequestGate> {
    const gate = await this.evaluateEditorRequest(manuscriptId);
    if (!gate.allowed) {
      throw new EditorRequestDeniedError(gate.reason);
    }
    return gate;
  }

  /**
   * Editor-facing "Pending" card: audit queue + revision findings + human-ledger preview.
   * **Does not** return `body_text` / outline prose — keep blurred in UI until the author accepts the match.
   */
  async getEditorPendingAssignmentView(manuscriptId: string): Promise<EditorPendingAssignmentView> {
    const { data: ms, error: msErr } = await this.supabase
      .from("p4_manuscripts")
      .select("id, tenant_id, title")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (msErr) throw new Error(`getEditorPendingAssignmentView: ${msErr.message}`);
    if (!ms) throw new Error(`Manuscript not found: ${manuscriptId}`);

    const tenantId = String((ms as { tenant_id: string }).tenant_id);
    const title = (ms as { title?: string | null }).title ?? null;

    const { data: queueRows, error: qErr } = await this.supabase
      .from("p4_audit_queue")
      .select("id, status, completed_at, comprehensive_report")
      .eq("manuscript_id", manuscriptId)
      .order("completed_at", { ascending: false })
      .limit(12);

    if (qErr) throw new Error(`audit queue: ${qErr.message}`);

    const { data: reportRows, error: rErr } = await this.supabase
      .from("p4_revision_reports")
      .select("id, finding_type, severity, created_at, details")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (rErr) throw new Error(`revision reports: ${rErr.message}`);

    const sovereignty = new AuthorSovereigntyService(this.supabase);
    const cert = await sovereignty.buildCertificateForTenant(tenantId, { limit: 24 });
    const human_ledger_certificate_preview = certificatePreviewFromFull(cert);

    const lore_breaches = (reportRows ?? []).filter((x) => {
      return String((x as Record<string, unknown>)["finding_type"] ?? "") === "CANON_MANUSCRIPT_GAP";
    }).length;
    const complexity_signals = (reportRows ?? []).filter((x) => {
      const ft = String((x as Record<string, unknown>)["finding_type"] ?? "");
      return ft === "HIGH_DYNAMIC_TENSION";
    }).length;

    const audit_queue_results = (queueRows ?? []).map((raw) => {
      const q = raw as Record<string, unknown>;
      const rep = q["comprehensive_report"];
      let reportExcerpt: string | null = null;
      if (rep && typeof rep === "object") {
        const lib = asRecord(asRecord(rep)["librarian"]);
        const ans = lib["answer"];
        if (typeof ans === "string" && ans.trim()) reportExcerpt = excerpt(ans, 900);
      }

      return {
        id: String(q["id"]),
        status: String(q["status"] ?? ""),
        completed_at: q["completed_at"] != null ? String(q["completed_at"]) : null,
        comprehensive_report_excerpt: reportExcerpt,
      };
    });

    const revision_audit_findings = (reportRows ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      const det = r["details"];
      let summary = "";
      if (det && typeof det === "object") {
        const d = asRecord(det);
        const s = d["summary"] ?? d["excerpt"];
        if (typeof s === "string") summary = excerpt(s, 220);
      }
      return {
        id: String(r["id"]),
        finding_type: String(r["finding_type"] ?? ""),
        severity: String(r["severity"] ?? ""),
        created_at: String(r["created_at"] ?? ""),
        details_summary: summary,
      };
    });

    return {
      manuscript_id: manuscriptId,
      tenant_id: tenantId,
      title,
      manuscript_body_hidden: true,
      visibility_notice:
        "Manuscript text is withheld until the author accepts the editor match. Use audit findings, " +
        "human-ledger certificate preview, and queue excerpts for triage only.",
      revision_metrics: { lore_breaches, complexity_signals },
      audit_queue_results,
      revision_audit_findings,
      human_ledger_certificate_preview,
    };
  }
}
