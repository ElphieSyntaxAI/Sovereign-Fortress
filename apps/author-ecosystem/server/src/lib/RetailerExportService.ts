/**
 * Retailer / publisher exports: Human Authorship Audit PDF, JSON metadata bundle (linguistic voice),
 * copyright front-matter snippet, and Amazon appeal letter template.
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import {
  AuthorSovereigntyService,
  buildHumanAuthorshipCertificate,
  craftSessionFromStylometricSnapshot,
  type HumanAuthorshipCertificate,
  type P4HalLedgerCertificateRow,
} from "./AuthorSovereigntyService.js";
import { latencyP90Ms } from "./halMetrics.js";

export type RetailerExportOptions = {
  /**
   * Public site base for verification links (no trailing slash), e.g. `https://your-msgf-host.com`.
   * The path `/human-authorship-audit/{audit_token}` is conventional — wire a route or redirect as needed.
   */
  verificationBaseUrl?: string;
};

export type RetailerLinguisticSessionPoint = {
  ledger_id: string;
  created_at: string;
  ttr: number;
  sentence_complexity: number;
  p90_latency_ms: number;
};

export type RetailerMetadataBundle = {
  schema: "elphie.retailer_metadata_bundle.v1";
  generated_at: string;
  manuscript_id: string;
  tenant_id: string;
  /** Opaque token derived from the audit payload (embed in verification route). */
  audit_token: string;
  verification_url: string;
  content_sha256: string;
  session_count: number;
  /** Most recent drafting window used as “current manuscript voice”. */
  linguistic_current: {
    mean_ttr: number;
    mean_sentence_complexity: number;
    session_count: number;
    sessions: RetailerLinguisticSessionPoint[];
  };
  /** Prior HAL sessions on this manuscript (chronological, excluding the current window). */
  linguistic_historical_voice: {
    description: string;
    mean_ttr: number;
    mean_sentence_complexity: number;
    session_count: number;
  };
  /** Whether current means sit inside a loose band around historical means (retailer-facing summary). */
  voice_alignment: {
    ttr_delta: number;
    sentence_complexity_delta: number;
    within_historical_band: boolean;
  };
};

export type AmazonAppealVariables = {
  author_legal_name: string;
  work_title: string;
  audit_date_iso: string;
  verification_url: string;
  publisher_or_imprint?: string;
};

const HISTORICAL_BAND_TTR = 0.06;
const HISTORICAL_BAND_COMPLEXITY = 1.25;
const CURRENT_WINDOW_SESSIONS = 3;

function sha256HexUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function manuscriptIdFromRow(row: P4HalLedgerCertificateRow): string | null {
  const raw = row.raw_sample;
  if (!raw || typeof raw !== "object") return null;
  const mid = (raw as Record<string, unknown>)["manuscriptId"];
  return typeof mid === "string" && mid.trim() ? mid.trim() : null;
}

function filterLedgerRowsForManuscript(
  rows: P4HalLedgerCertificateRow[],
  manuscriptId: string
): P4HalLedgerCertificateRow[] {
  const want = manuscriptId.trim();
  return rows.filter((r) => manuscriptIdFromRow(r) === want);
}

function latencySamplesMsFromRow(row: P4HalLedgerCertificateRow): number[] {
  const primary = Array.isArray(row.keystroke_latency_ms) ? row.keystroke_latency_ms : [];
  const raw = row.raw_sample;
  const rawArr =
    raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>)["raw_keystroke_latency_ms"])
      ? ((raw as Record<string, unknown>)["raw_keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
      : [];
  const merged = primary.length > 0 ? primary : rawArr.filter((n) => Number.isFinite(n));
  return merged.filter((n) => Number.isFinite(n)) as number[];
}

function linguisticPointFromRow(row: P4HalLedgerCertificateRow): RetailerLinguisticSessionPoint | null {
  const craft = craftSessionFromStylometricSnapshot(row.stylometric_snapshot);
  if (!craft) return null;
  const samplesMs = latencySamplesMsFromRow(row);
  const p90 = latencyP90Ms(samplesMs);
  return {
    ledger_id: row.id,
    created_at: row.created_at,
    ttr: craft.ttr,
    sentence_complexity: craft.sentenceComplexity,
    p90_latency_ms: Math.round(p90),
  };
}

function buildVoiceSlices(
  chronological: RetailerLinguisticSessionPoint[]
): {
  current: RetailerLinguisticSessionPoint[];
  historical: RetailerLinguisticSessionPoint[];
} {
  if (chronological.length <= CURRENT_WINDOW_SESSIONS) {
    return { current: [...chronological], historical: [] };
  }
  const historical = chronological.slice(0, -CURRENT_WINDOW_SESSIONS);
  const current = chronological.slice(-CURRENT_WINDOW_SESSIONS);
  return { current, historical };
}

function verificationUrlForToken(base: string, auditToken: string): string {
  const b = base.replace(/\/$/, "");
  return `${b}/human-authorship-audit/${auditToken}`;
}

export class RetailerExportService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly options: RetailerExportOptions = {}
  ) {}

  /**
   * HAL rows for this manuscript (newest first in query; reordered chronologically for growth / voice).
   */
  async fetchManuscriptLedgerRows(
    tenantId: string,
    manuscriptId: string,
    limit = 120
  ): Promise<P4HalLedgerCertificateRow[]> {
    const svc = new AuthorSovereigntyService(this.supabase);
    const rows = await svc.fetchHalLedgerForCertificate(tenantId, { limit });
    const filtered = filterLedgerRowsForManuscript(rows, manuscriptId);
    return filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  /**
   * Portable certificate (SHA-256 over canonical session latency payload) scoped to this manuscript’s ledger rows.
   */
  async buildManuscriptAuthorshipCertificate(
    tenantId: string,
    manuscriptId: string
  ): Promise<HumanAuthorshipCertificate> {
    const rows = await this.fetchManuscriptLedgerRows(tenantId, manuscriptId, 120);
    return buildHumanAuthorshipCertificate(tenantId, rows);
  }

  /**
   * JSON bundle for publisher / retailer due diligence: TTR + sentence complexity vs historical voice on the same manuscript.
   */
  async buildPublisherRetailerMetadataBundle(
    tenantId: string,
    manuscriptId: string
  ): Promise<RetailerMetadataBundle> {
    const rows = await this.fetchManuscriptLedgerRows(tenantId, manuscriptId, 120);
    const chronological: RetailerLinguisticSessionPoint[] = [];
    for (const r of rows) {
      const p = linguisticPointFromRow(r);
      if (p) chronological.push(p);
    }

    const { current, historical } = buildVoiceSlices(chronological);
    const meanTtrC = mean(current.map((s) => s.ttr));
    const meanCxC = mean(current.map((s) => s.sentence_complexity));
    const meanTtrH = historical.length ? mean(historical.map((s) => s.ttr)) : meanTtrC;
    const meanCxH = historical.length ? mean(historical.map((s) => s.sentence_complexity)) : meanCxC;

    const cert = buildHumanAuthorshipCertificate(tenantId, rows);
    const bundleCanon = JSON.stringify({
      manuscript_id: manuscriptId,
      tenant_id: tenantId,
      content_sha256: cert.contentSha256,
      linguistic_current: current,
      linguistic_historical: historical,
    });
    const audit_token = sha256HexUtf8(bundleCanon).slice(0, 40);
    const base = this.options.verificationBaseUrl?.trim() || "https://your-deployment.example.com";
    const verification_url = verificationUrlForToken(base, audit_token);

    const ttr_delta = Math.round((meanTtrC - meanTtrH) * 10_000) / 10_000;
    const sentence_complexity_delta = Math.round((meanCxC - meanCxH) * 1000) / 1000;
    const within_historical_band =
      Math.abs(meanTtrC - meanTtrH) <= HISTORICAL_BAND_TTR &&
      Math.abs(meanCxC - meanCxH) <= HISTORICAL_BAND_COMPLEXITY;

    return {
      schema: "elphie.retailer_metadata_bundle.v1",
      generated_at: new Date().toISOString(),
      manuscript_id: manuscriptId.trim(),
      tenant_id: tenantId.trim(),
      audit_token,
      verification_url,
      content_sha256: cert.contentSha256,
      session_count: cert.sessionCount,
      linguistic_current: {
        mean_ttr: Math.round(meanTtrC * 10_000) / 10_000,
        mean_sentence_complexity: Math.round(meanCxC * 1000) / 1000,
        session_count: current.length,
        sessions: current,
      },
      linguistic_historical_voice: {
        description:
          "Prior HAL drafting sessions on this manuscript (same tenant), excluding the most recent window used as “current”.",
        mean_ttr: Math.round(meanTtrH * 10_000) / 10_000,
        mean_sentence_complexity: Math.round(meanCxH * 1000) / 1000,
        session_count: historical.length,
      },
      voice_alignment: {
        ttr_delta,
        sentence_complexity_delta,
        within_historical_band,
      },
    };
  }

  /**
   * Copy-paste front matter (copyright / edition notice). Unique line includes `verification_url`.
   */
  buildCopyrightFrontMatterSnippet(input: {
    work_title: string;
    verification_url: string;
    rights_holder_line?: string;
  }): string {
    const rights = input.rights_holder_line?.trim() || "All rights reserved.";
    return [
      "---",
      `Human authorship attestation: ${input.work_title.trim()}`,
      `Independent audit verification: ${input.verification_url}`,
      rights,
      "---",
    ].join("\n");
  }

  /**
   * Amazon / marketplace appeal: statement of human authorship (pass resolved strings in `AmazonAppealVariables`).
   */
  renderAmazonHumanAuthorshipStatement(v: AmazonAppealVariables): string {
    const imprint = v.publisher_or_imprint?.trim() ? ` (${v.publisher_or_imprint.trim()})` : "";
    return [
      "Statement of Human Authorship",
      "",
      `To whom it may concern,`,
      "",
      `I, ${v.author_legal_name}, affirm under penalty of perjury that the literary work titled “${v.work_title}”${imprint} is my original human-authored creation.`,
      "",
      `I maintain contemporaneous drafting telemetry (keystroke cadence, revision timing, and linguistic stylometry) consistent with human composition. An independent audit bundle summarizing type–token ratio (TTR), sentence-complexity statistics, and session-level forensic summaries is available at:`,
      "",
      v.verification_url,
      "",
      `Audit reference date (UTC): ${v.audit_date_iso}`,
      "",
      `This statement is provided in response to automated classification or policy inquiries regarding generative-AI origin. I am prepared to supply additional publisher-facing documentation upon request.`,
      "",
      "Respectfully,",
      v.author_legal_name,
    ].join("\n");
  }

  /**
   * pdf-lib audit: SHA-256, session heatmap (latency intensity), and a seal graphic.
   */
  async generateHumanAuthorshipAuditPdf(tenantId: string, manuscriptId: string): Promise<Uint8Array> {
    const cert = await this.buildManuscriptAuthorshipCertificate(tenantId, manuscriptId);
    const rows = await this.fetchManuscriptLedgerRows(tenantId, manuscriptId, 120);

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const page1 = doc.addPage([612, 792]);
    let y = 740;
    const left = 48;
    const line = (p: typeof page1, text: string, size = 10, f = font, color = rgb(0.12, 0.12, 0.14)) => {
      const chunks = text.match(/.{1,100}/g) ?? [text];
      for (const c of chunks) {
        p.drawText(c, { x: left, y, size, font: f, color });
        y -= size + 3;
      }
    };

    page1.drawText("Human Authorship Audit", {
      x: left,
      y,
      size: 20,
      font: bold,
      color: rgb(0.05, 0.28, 0.2),
    });
    y -= 28;
    line(page1, `Manuscript: ${manuscriptId}`);
    line(page1, `Tenant: ${tenantId}`);
    line(page1, `Issued (UTC): ${cert.issuedAt}`);
    line(page1, `Sessions in scope: ${cert.sessionCount}`);
    y -= 6;
    line(page1, "Content SHA-256 (canonical latency bundle):", 11, bold);
    line(page1, cert.contentSha256, 9, font, rgb(0.15, 0.15, 0.5));
    y -= 10;

    // Seal of Authenticity
    const sealX = 420;
    const sealY = 640;
    page1.drawEllipse({
      x: sealX,
      y: sealY,
      xScale: 72,
      yScale: 32,
      borderColor: rgb(0.1, 0.45, 0.28),
      borderWidth: 2,
      color: rgb(0.92, 0.98, 0.94),
      opacity: 0.85,
    });
    page1.drawText("SEAL OF", { x: sealX - 28, y: sealY + 6, size: 8, font: bold, color: rgb(0.05, 0.35, 0.22) });
    page1.drawText("AUTHENTICITY", { x: sealX - 44, y: sealY - 6, size: 8, font: bold, color: rgb(0.05, 0.35, 0.22) });
    page1.drawText(cert.issuedAt.slice(0, 10), {
      x: sealX - 32,
      y: sealY - 22,
      size: 7,
      font,
      color: rgb(0.2, 0.35, 0.25),
    });

    y -= 16;
    line(page1, "Session heatmap (p90 inter-key latency ms — darker = hotter rhythm)", 11, bold);
    const heatY = y - 8;
    const barLeft = left;
    const barMaxW = 480;
    const sessionsForHeat = cert.sessions.slice(-24);
    const p90s = sessionsForHeat.map((s) => s.latencyProof.p90Ms);
    const maxP90 = Math.max(1, ...p90s, 1);
    const n = Math.max(1, sessionsForHeat.length);
    const barW = Math.max(2, Math.min(36, Math.floor(barMaxW / Math.max(n, 1)) - 4));
    let x = barLeft;
    for (let i = 0; i < sessionsForHeat.length; i += 1) {
      const p90 = p90s[i] ?? 0;
      const intensity = Math.min(1, p90 / maxP90);
      const h = 8 + intensity * 72;
      const g = 0.35 + intensity * 0.55;
      page1.drawRectangle({
        x,
        y: heatY - h,
        width: barW,
        height: h,
        color: rgb(0.05, g, 0.28 + intensity * 0.25),
      });
      x += barW + 6;
      if (x > barLeft + barMaxW) break;
    }
    y = heatY - 100;
    line(page1, "Per-session summary (newest tail):", 11, bold);
    for (const s of cert.sessions.slice(-10).reverse()) {
      if (y < 96) break;
      const t = `${s.createdAt} | p90=${s.latencyProof.p90Ms}ms | n=${s.latencyProof.sampleCount} | HAL=${s.halScoreFinal ?? "—"}`;
      line(page1, t, 8);
    }

    page1.drawText(
      "This audit summarizes forensic drafting telemetry. Full arrays remain in the JSON certificate export.",
      { x: left, y: 56, size: 8, font, color: rgb(0.38, 0.38, 0.4) }
    );

    // Second page: linguistic TTR / complexity table from stylometric snapshots
    const page2 = doc.addPage([612, 792]);
    y = 740;
    page2.drawText("Linguistic profile (TTR & sentence complexity)", {
      x: left,
      y,
      size: 16,
      font: bold,
      color: rgb(0.08, 0.22, 0.38),
    });
    y -= 28;
    const l2 = (text: string, size = 9, f = font, color = rgb(0.12, 0.12, 0.14)) => {
      page2.drawText(text.slice(0, 110), { x: left, y, size, font: f, color });
      y -= size + 3;
    };
    l2("Ledger ID (prefix) | UTC | TTR | Sentence complexity index", 9, bold);
    for (const r of rows.slice(-20).reverse()) {
      if (y < 80) break;
      const craft = craftSessionFromStylometricSnapshot(r.stylometric_snapshot);
      if (!craft) continue;
      l2(`${r.id.slice(0, 8)}… | ${r.created_at} | ${craft.ttr} | ${craft.sentenceComplexity}`);
    }

    return doc.save();
  }

  /**
   * One call: PDF bytes + metadata JSON string + front-matter snippet + Amazon letter (filled from bundle URL).
   */
  async buildFullRetailerPack(
    tenantId: string,
    manuscriptId: string,
    amazon: Pick<AmazonAppealVariables, "author_legal_name" | "work_title" | "publisher_or_imprint">
  ): Promise<{
    pdf: Uint8Array;
    metadata_json: string;
    metadata: RetailerMetadataBundle;
    copyright_snippet: string;
    amazon_statement: string;
  }> {
    const bundle = await this.buildPublisherRetailerMetadataBundle(tenantId, manuscriptId);
    const pdf = await this.generateHumanAuthorshipAuditPdf(tenantId, manuscriptId);
    const copyright_snippet = this.buildCopyrightFrontMatterSnippet({
      work_title: amazon.work_title,
      verification_url: bundle.verification_url,
    });
    const amazon_statement = this.renderAmazonHumanAuthorshipStatement({
      author_legal_name: amazon.author_legal_name,
      work_title: amazon.work_title,
      audit_date_iso: bundle.generated_at,
      verification_url: bundle.verification_url,
      publisher_or_imprint: amazon.publisher_or_imprint,
    });
    return {
      pdf,
      metadata_json: JSON.stringify(bundle, null, 2),
      metadata: bundle,
      copyright_snippet,
      amazon_statement,
    };
  }
}
