/**
 * Gatekeeper for "Request Editor Assignment" and editor-safe previews (no manuscript body until match).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthorSovereigntyService } from "./AuthorSovereigntyService.js";
import type { HumanAuthorshipCertificate } from "./AuthorSovereigntyService.js";

export type EditorRequestGate = {
  allowed: boolean;
  revision_count: number;
  revision_status: string;
  /** Mean HAL score across recent `p4_hal_ledger` rows tied to this manuscript (`raw_sample.manuscriptId`). */
  hal_average_score: number;
  /** Stored manuscript audit score (informational; gate uses `hal_average_score`). */
  manuscript_audit_score: number;
  checks: {
    revisions_ok: boolean;
    auditing_complete: boolean;
    hal_human_effort_ok: boolean;
  };
  reason: string;
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

const MIN_REVISIONS = 2;
const REQUIRED_REVISION_STATUS = "AUDITING_COMPLETE";
const HAL_AVERAGE_MIN = 0.85;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function halScoreFromLedgerRow(row: Record<string, unknown>): number | null {
  const raw = asRecord(row["raw_sample"]);
  const snap = asRecord(row["stylometric_snapshot"]);
  const fromRaw = raw["hal_score"];
  if (typeof fromRaw === "number" && Number.isFinite(fromRaw)) return fromRaw;
  const fromSnap = snap["hal_score_final"];
  if (typeof fromSnap === "number" && Number.isFinite(fromSnap)) return fromSnap;
  return null;
}

/**
 * Mean HAL score for ledger rows whose `raw_sample.manuscriptId` matches this manuscript.
 */
async function computeHalAverageScoreForManuscript(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string,
  sampleLimit = 48
): Promise<number> {
  const { data, error } = await supabase
    .from("p4_hal_ledger")
    .select("raw_sample, stylometric_snapshot")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(sampleLimit);

  if (error) throw new Error(`HAL average: ${error.message}`);

  const scores: number[] = [];
  for (const row of data ?? []) {
    const raw = asRecord((row as Record<string, unknown>)["raw_sample"]);
    if (String(raw["manuscriptId"] ?? "") !== manuscriptId) continue;
    const s = halScoreFromLedgerRow(row as Record<string, unknown>);
    if (s != null) scores.push(s);
  }

  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10_000) / 10_000;
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
   * Gatekeeper: allow "Request Editor" only when **all** hold:
   * - `revision_count >= 2`
   * - `revision_status === 'AUDITING_COMPLETE'`
   * - mean HAL score for this manuscript (ledger rows with matching `raw_sample.manuscriptId`) **> 0.85**
   */
  async evaluateEditorRequest(manuscriptId: string): Promise<EditorRequestGate> {
    const { data, error } = await this.supabase
      .from("p4_manuscripts")
      .select("tenant_id, revision_count, revision_status, audit_score")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (error) throw new Error(`evaluateEditorRequest: ${error.message}`);
    if (!data) {
      return {
        allowed: false,
        revision_count: 0,
        revision_status: "",
        hal_average_score: 0,
        manuscript_audit_score: 0,
        checks: {
          revisions_ok: false,
          auditing_complete: false,
          hal_human_effort_ok: false,
        },
        reason: "Manuscript not found.",
      };
    }

    const row = data as Record<string, unknown>;
    const tenantId = String(row["tenant_id"] ?? "");
    const revision_count = Number(row["revision_count"] ?? 0);
    const revision_status = String(row["revision_status"] ?? "");
    const manuscript_audit_score = Number(row["audit_score"] ?? 0);

    const hal_average_score = await computeHalAverageScoreForManuscript(
      this.supabase,
      tenantId,
      manuscriptId
    );

    const revisions_ok = revision_count >= MIN_REVISIONS;
    const auditing_complete = revision_status === REQUIRED_REVISION_STATUS;
    const hal_human_effort_ok = hal_average_score > HAL_AVERAGE_MIN;
    const allowed = revisions_ok && auditing_complete && hal_human_effort_ok;

    const parts: string[] = [];
    if (!revisions_ok) parts.push(`revision_count must be >= ${MIN_REVISIONS} (got ${revision_count}).`);
    if (!auditing_complete) parts.push(`revision_status must be ${REQUIRED_REVISION_STATUS} (got ${revision_status || "unknown"}).`);
    if (!hal_human_effort_ok) {
      parts.push(`HAL average score must be > ${HAL_AVERAGE_MIN} (got ${hal_average_score}).`);
    }

    const reason = allowed
      ? "All gatekeeper checks passed — editor assignment may be requested."
      : parts.join(" ");

    return {
      allowed,
      revision_count,
      revision_status,
      hal_average_score,
      manuscript_audit_score,
      checks: { revisions_ok, auditing_complete, hal_human_effort_ok },
      reason,
    };
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
        "HAL certificate preview, and queue excerpts for triage only.",
      revision_metrics: { lore_breaches, complexity_signals },
      audit_queue_results,
      revision_audit_findings,
      human_ledger_certificate_preview,
    };
  }
}
