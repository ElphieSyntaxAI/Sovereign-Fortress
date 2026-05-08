/**
 * Copyright / litigation support: evidence packet (HAL certificate PDF, anonymized session log, helper labor affidavits).
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { exportHumanAuthorshipCertificatePdf } from "./AuthorSovereigntyService.js";
import { HelperProofService } from "./HelperProofService.js";
import { RetailerExportService } from "./RetailerExportService.js";
import type { P4ManuscriptRow } from "./RevisionLockService.js";

export type AnonymizedHumanSessionLogEntry = {
  session_index: number;
  occurred_at_utc: string;
  latency_sample_count: number;
  p90_latency_ms: number;
  /** Binned HAL signal — no raw model output. */
  hal_score_bucket: string | null;
};

export type AnonymizedSessionLog = {
  schema: "elphie.anonymized_human_session_log.v1";
  generated_at_utc: string;
  manuscript_id: string;
  /** No ledger UUIDs, author IDs, or raw keystroke arrays. */
  entries: AnonymizedHumanSessionLogEntry[];
};

export type HelperThreeDraftAffidavitStage = {
  milestone_type: string;
  uploaded_at_utc: string | null;
  artifact_present: boolean;
  /** SHA-256 of artifact URL when present — chain-of-custody without exposing storage paths. */
  artifact_reference_sha256: string | null;
};

/**
 * One manuscript’s helper labor proof (SEED / GROWTH / HARVEST). The current schema stores a single
 * three-stage chain per `project_id` (= manuscript); if multiple helpers are modeled later, extend this array.
 */
export type HelperThreeDraftAffidavit = {
  project_id: string;
  author_verified_human_flow_at_utc: string | null;
  stages: HelperThreeDraftAffidavitStage[];
  narrative_summary: string;
};

export type HelperAffidavitBundle = {
  schema: "elphie.helper_affidavit_bundle.v1";
  generated_at_utc: string;
  manuscript_id: string;
  affidavits: HelperThreeDraftAffidavit[];
};

export type CopyrightEvidencePacket = {
  generated_at_utc: string;
  manuscript_id: string;
  tenant_id: string;
  /** Standard Human Authorship Certificate PDF (latency bundle + SHA-256). */
  hal_certificate_pdf: Uint8Array;
  session_log: AnonymizedSessionLog;
  helper_affidavits: HelperAffidavitBundle;
  session_log_json: string;
  helper_affidavits_json: string;
};

function sha256HexUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function halScoreBucket(score: number | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  const n = score > 1 ? score / 100 : score;
  if (n < 0.55) return "0.00–0.55";
  if (n < 0.7) return "0.55–0.70";
  if (n < 0.85) return "0.70–0.85";
  return "0.85–1.00";
}

function buildHelperAffidavitNarrative(
  manuscriptTitle: string | null,
  snap: Awaited<ReturnType<HelperProofService["getAuditSnapshot"]>>
): string {
  const title = manuscriptTitle?.trim() || "this manuscript";
  const parts: string[] = [
    `Helper labor attestation for ${title} (project ${snap.project_id}).`,
    `The author recorded three staged deliverables — SEED, GROWTH, and HARVEST — as proof of human editorial or assistance labor.`,
  ];
  for (const s of snap.stages) {
    const ok = Boolean(s.file_url?.trim());
    parts.push(
      `${s.milestone_type}: ${ok ? `artifact logged at ${s.uploaded_at ?? "unknown time"} UTC` : "no artifact on file"}.`
    );
  }
  if (snap.verified_human_flow_at) {
    parts.push(`Author verified human-flow (UTC): ${snap.verified_human_flow_at}.`);
  } else {
    parts.push("Author human-flow verification timestamp is not yet recorded.");
  }
  return parts.join(" ");
}

export class CopyrightLegalService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Bundles HAL certificate PDF, anonymized human session timestamps, and helper three-draft affidavits
   * for the manuscript. Uses service-role or tenant-scoped client per your deployment.
   */
  async generateCopyrightEvidencePacket(manuscriptId: string): Promise<CopyrightEvidencePacket> {
    const mid = manuscriptId.trim();
    if (!mid) throw new Error("generateCopyrightEvidencePacket: manuscriptId is required");

    const { data: msRow, error: msErr } = await this.supabase
      .from("p4_manuscripts")
      .select("id, tenant_id, title, verified_human_flow_at")
      .eq("id", mid)
      .maybeSingle();

    if (msErr) throw new Error(`generateCopyrightEvidencePacket: ${msErr.message}`);
    if (!msRow) throw new Error(`generateCopyrightEvidencePacket: manuscript not found (${mid})`);

    const ms = msRow as P4ManuscriptRow;
    const tenantId = String(ms.tenant_id ?? "");
    const title = ms.title != null ? String(ms.title) : null;
    const verifiedAt = ms.verified_human_flow_at != null ? String(ms.verified_human_flow_at) : null;

    const retailer = new RetailerExportService(this.supabase);
    const cert = await retailer.buildManuscriptAuthorshipCertificate(tenantId, mid);
    const hal_certificate_pdf = await exportHumanAuthorshipCertificatePdf(cert);

    const generated_at_utc = new Date().toISOString();

    const entries: AnonymizedHumanSessionLogEntry[] = cert.sessions.map((s, i) => ({
      session_index: i + 1,
      occurred_at_utc: s.createdAt,
      latency_sample_count: s.latencyProof.sampleCount,
      p90_latency_ms: s.latencyProof.p90Ms,
      hal_score_bucket: halScoreBucket(s.halScoreFinal),
    }));

    const session_log: AnonymizedSessionLog = {
      schema: "elphie.anonymized_human_session_log.v1",
      generated_at_utc,
      manuscript_id: mid,
      entries,
    };

    const hp = new HelperProofService(this.supabase);
    let snap = HelperProofService.emptyAuditSnapshot(mid, verifiedAt);
    try {
      snap = await hp.getAuditSnapshot(mid, verifiedAt, tenantId);
    } catch {
      snap = HelperProofService.emptyAuditSnapshot(mid, verifiedAt);
    }

    const stages: HelperThreeDraftAffidavitStage[] = snap.stages.map((s) => {
      const url = s.file_url?.trim() ?? "";
      const artifact_present = url.length > 0;
      return {
        milestone_type: s.milestone_type,
        uploaded_at_utc: s.uploaded_at,
        artifact_present,
        artifact_reference_sha256: artifact_present ? sha256HexUtf8(url) : null,
      };
    });

    const affidavit: HelperThreeDraftAffidavit = {
      project_id: snap.project_id,
      author_verified_human_flow_at_utc: snap.verified_human_flow_at,
      stages,
      narrative_summary: buildHelperAffidavitNarrative(title, snap),
    };

    const helper_affidavits: HelperAffidavitBundle = {
      schema: "elphie.helper_affidavit_bundle.v1",
      generated_at_utc,
      manuscript_id: mid,
      affidavits: [affidavit],
    };

    return {
      generated_at_utc,
      manuscript_id: mid,
      tenant_id: tenantId,
      hal_certificate_pdf,
      session_log,
      helper_affidavits,
      session_log_json: JSON.stringify(session_log, null, 2),
      helper_affidavits_json: JSON.stringify(helper_affidavits, null, 2),
    };
  }
}
