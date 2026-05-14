/**
 * Sovereign NDA automation: template, dual digital signatures (IP + timestamp + manuscript SHA-256),
 * receipt PDF, engagement emails, and editor forensic data gate.
 */

import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import type { SupabaseClient } from "@supabase/supabase-js";

import { P4_HAL_LEDGER } from "./database/canonicalIdentifiers.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type LegalContractParty = "author" | "helper";

export type P4LegalContractStatus = "PENDING_AUTHOR" | "PENDING_HELPER" | "FULLY_EXECUTED";

export type P4LegalContractRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  helper_id: string;
  contract_kind: string;
  template_version: string;
  nda_body_snapshot: string;
  status: P4LegalContractStatus;
  author_signed_at: string | null;
  author_signer_ip: string | null;
  author_manuscript_sha256: string | null;
  helper_signed_at: string | null;
  helper_signer_ip: string | null;
  helper_manuscript_sha256: string | null;
  executed_at: string | null;
  author_notify_email: string | null;
  helper_notify_email: string | null;
  receipt_pdf_sha256: string | null;
  email_sent_at: string | null;
};

export type HalLatencyPointDto = { at: string; p90_ms: number };
export type LoreBreachMarkerDto = {
  id: string;
  severity: string;
  created_at: string;
  summary: string;
  excerpt: string;
  cosine_similarity: number | null;
};

export type EditorForensicBundleDto = {
  schema: "elphie.editor_forensic_bundle.v1";
  manuscript_id: string;
  helper_id: string;
  hal_points: HalLatencyPointDto[];
  lore_breaches: LoreBreachMarkerDto[];
};

export class ForensicAccessDeniedError extends Error {
  readonly status = 403 as const;
  constructor(message = "Signed Sovereign NDA required for this manuscript and helper engagement.") {
    super(message);
    this.name = "ForensicAccessDeniedError";
  }
}

function sha256HexUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function manuscriptIdFromRawSample(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const mid = (raw as Record<string, unknown>)["manuscriptId"];
  return typeof mid === "string" && mid.trim() ? mid.trim() : null;
}

function p90ms(samples: number[]): number {
  const s = samples.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor(0.9 * (s.length - 1))));
  return Math.round(s[idx]!);
}

function latencySamplesFromRow(raw: Record<string, unknown>): number[] {
  const primary = Array.isArray(raw["keystroke_latency_ms"])
    ? (raw["keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
    : [];
  const rs = raw["raw_sample"];
  const rawSample = rs && typeof rs === "object" ? (rs as Record<string, unknown>) : null;
  const rawArr =
    rawSample && Array.isArray(rawSample["raw_keystroke_latency_ms"])
      ? (rawSample["raw_keystroke_latency_ms"] as unknown[]).map((n) => Number(n))
      : [];
  const merged = primary.length > 0 ? primary : rawArr;
  return merged.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

/** Standard Sovereign NDA — authorship IP + editor professional time (Markdown snapshot stored on contract). */
export function sovereignNdaTemplateMarkdown(context: {
  manuscript_title: string;
  manuscript_id: string;
  helper_display_name?: string;
}): string {
  const h = context.helper_display_name?.trim() || "the assigned editorial / apprentice professional";
  return [
    "# Sovereign Non-Disclosure & Professional Engagement Agreement",
    "",
    `**Work:** “${context.manuscript_title}” (manuscript id \`${context.manuscript_id}\`)`,
    "",
    "## 1. Authorship intellectual property",
    "The author retains all rights, title, and interest in original literary authorship, including characters, plot, setting, and unpublished manuscript text. Access is granted solely to perform agreed editorial or apprentice services.",
    "",
    "## 2. Editor / professional time",
    `${h} agrees to use confidential materials only for delivery of scoped services, to preserve forensic integrity of drafting telemetry where applicable, and not to train unrelated automated systems on the author’s private manuscript without separate written consent.`,
    "",
    "## 3. Confidentiality & survival",
    "Obligations survive termination of the engagement for **three (3) years** from the last access date, except where a longer period is required by law.",
    "",
    "## 4. Digital execution",
    "Each party’s click-to-sign records IP address, UTC timestamp, and a SHA-256 digest of the manuscript body at signing, stored in `p4_legal_contracts`.",
    "",
    "*This template is informational; have counsel adapt governing law, venue, and definitions for your jurisdiction.*",
  ].join("\n");
}

export function clientIpFromHeaders(getHeader: (name: string) => string | null | undefined): string {
  const xff = getHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
  const real = getHeader("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return "unknown";
}

export class ContractAutomationService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Throws {@link ForensicAccessDeniedError} unless a **fully executed** Sovereign NDA exists for this pair.
   */
  async assertEditorForensicGate(manuscriptId: string, helperId: string): Promise<void> {
    const mid = manuscriptId.trim();
    const hid = helperId.trim();
    if (!mid || !hid) throw new ForensicAccessDeniedError("manuscript_id and helper_id are required.");

    const { data, error } = await this.supabase
      .from("p4_legal_contracts")
      .select("id, status, author_signed_at, helper_signed_at")
      .eq("manuscript_id", mid)
      .eq("helper_id", hid)
      .maybeSingle();

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        throw new ForensicAccessDeniedError("Legal contracts table is not available.");
      }
      throw new Error(`assertEditorForensicGate: ${error.message}`);
    }
    if (!data) throw new ForensicAccessDeniedError("No NDA record exists for this manuscript and helper.");
    const row = data as Record<string, unknown>;
    const ok =
      String(row["status"] ?? "") === "FULLY_EXECUTED" &&
      row["author_signed_at"] != null &&
      row["helper_signed_at"] != null;
    if (!ok) throw new ForensicAccessDeniedError("NDA is not fully signed for this manuscript and helper.");
  }

  /**
   * HAL latency points + lore breach markers for editor UI (service-role client recommended after gate).
   */
  async buildEditorForensicBundle(manuscriptId: string, helperId: string): Promise<EditorForensicBundleDto> {
    await this.assertEditorForensicGate(manuscriptId, helperId);
    const mid = manuscriptId.trim();

    const { data: halRows, error: hErr } = await this.supabase
      .from(P4_HAL_LEDGER)
      .select("id, created_at, keystroke_latency_ms, raw_sample")
      .order("created_at", { ascending: true })
      .limit(220);

    if (hErr) throw new Error(`buildEditorForensicBundle hal: ${hErr.message}`);

    const hal_points: HalLatencyPointDto[] = [];
    for (const row of halRows ?? []) {
      const o = row as Record<string, unknown>;
      const raw = o["raw_sample"];
      if (manuscriptIdFromRawSample(raw) !== mid) continue;
      hal_points.push({ at: String(o["created_at"] ?? ""), p90_ms: p90ms(latencySamplesFromRow(o)) });
    }

    const { data: repRows, error: rErr } = await this.supabase
      .from("p4_revision_reports")
      .select("id, finding_type, severity, created_at, details, cosine_similarity")
      .eq("manuscript_id", mid)
      .order("created_at", { ascending: false })
      .limit(80);

    if (rErr) throw new Error(`buildEditorForensicBundle reports: ${rErr.message}`);

    const lore_breaches: LoreBreachMarkerDto[] = [];
    for (const raw of repRows ?? []) {
      const r = raw as Record<string, unknown>;
      if (String(r["finding_type"] ?? "") !== "CANON_MANUSCRIPT_GAP") continue;
      const det = asRecord(r["details"]);
      const summary = typeof det["summary"] === "string" ? det["summary"] : "Lore / canon alignment gap";
      const excerpt = typeof det["excerpt"] === "string" ? det["excerpt"] : "";
      const cos = r["cosine_similarity"];
      lore_breaches.push({
        id: String(r["id"] ?? ""),
        severity: String(r["severity"] ?? "info"),
        created_at: String(r["created_at"] ?? ""),
        summary,
        excerpt: excerpt.slice(0, 600),
        cosine_similarity: typeof cos === "number" && Number.isFinite(cos) ? cos : null,
      });
    }

    return {
      schema: "elphie.editor_forensic_bundle.v1",
      manuscript_id: mid,
      helper_id: helperId.trim(),
      hal_points,
      lore_breaches,
    };
  }

  /**
   * Click-to-sign: records IP, UTC timestamp, and SHA-256 of manuscript `body_text` for the signing party.
   * When both parties have signed, marks **FULLY_EXECUTED**, builds receipt PDF hash, and triggers {@link dispatchEngagementReceipts}.
   */
  async recordDigitalSignature(input: {
    tenantId: string;
    manuscriptId: string;
    helperId: string;
    party: LegalContractParty;
    signerIp: string;
    authorNotifyEmail?: string | null;
    helperNotifyEmail?: string | null;
  }): Promise<P4LegalContractRow> {
    const tenantId = input.tenantId.trim();
    const manuscriptId = input.manuscriptId.trim();
    const helperId = input.helperId.trim();
    const ip = input.signerIp.trim().slice(0, 64) || "unknown";
    const now = new Date().toISOString();

    const { data: ms, error: mErr } = await this.supabase
      .from("p4_manuscripts")
      .select("id, tenant_id, title, body_text")
      .eq("id", manuscriptId)
      .maybeSingle();
    if (mErr) throw new Error(`recordDigitalSignature: ${mErr.message}`);
    if (!ms) throw new Error("Manuscript not found.");
    const m = ms as Record<string, unknown>;
    if (String(m["tenant_id"] ?? "") !== tenantId) throw new Error("Tenant mismatch for manuscript.");

    const body = String(m["body_text"] ?? "");
    const manuscriptSha = sha256HexUtf8(body);
    const title = m["title"] != null ? String(m["title"]) : "Untitled";

    const { data: helperRow } = await this.supabase.from("p4_helpers").select("display_name").eq("id", helperId).maybeSingle();
    const helperName =
      helperRow && typeof (helperRow as Record<string, unknown>)["display_name"] === "string"
        ? String((helperRow as Record<string, unknown>)["display_name"])
        : undefined;

    const nda_body_snapshot = sovereignNdaTemplateMarkdown({
      manuscript_title: title,
      manuscript_id: manuscriptId,
      helper_display_name: helperName,
    });

    const { data: existing, error: exErr } = await this.supabase
      .from("p4_legal_contracts")
      .select("*")
      .eq("manuscript_id", manuscriptId)
      .eq("helper_id", helperId)
      .maybeSingle();
    if (exErr) throw new Error(`recordDigitalSignature: ${exErr.message}`);

    const priorReceiptHash = existing ? (existing as Record<string, unknown>)["receipt_pdf_sha256"] : null;

    let row: Record<string, unknown>;

    if (!existing) {
      if (input.party !== "author") {
        throw new Error("First signature on a new engagement must be from the author (party=author).");
      }
      const insert = {
        tenant_id: tenantId,
        manuscript_id: manuscriptId,
        helper_id: helperId,
        contract_kind: "SOVEREIGN_NDA",
        template_version: "sovereign-nda.v1",
        nda_body_snapshot,
        status: "PENDING_HELPER" as P4LegalContractStatus,
        author_signed_at: now,
        author_signer_ip: ip,
        author_manuscript_sha256: manuscriptSha,
        helper_signed_at: null,
        helper_signer_ip: null,
        helper_manuscript_sha256: null,
        executed_at: null,
        author_notify_email: input.authorNotifyEmail?.trim() || null,
        helper_notify_email: input.helperNotifyEmail?.trim() || null,
        updated_at: now,
      };
      const { data: ins, error: iErr } = await this.supabase.from("p4_legal_contracts").insert(insert).select("*").single();
      if (iErr) throw new Error(`recordDigitalSignature insert: ${iErr.message}`);
      row = ins as Record<string, unknown>;
    } else {
      const ex = existing as Record<string, unknown>;
      const authorAt = ex["author_signed_at"] != null ? String(ex["author_signed_at"]) : null;
      const helperAt = ex["helper_signed_at"] != null ? String(ex["helper_signed_at"]) : null;
      if (input.party === "author") {
        if (authorAt) throw new Error("Author has already signed this contract.");
      } else {
        if (!authorAt) throw new Error("Author must sign before the helper can sign.");
        if (helperAt) throw new Error("Helper has already signed this contract.");
      }

      const nextAuthorAt = input.party === "author" ? now : authorAt;
      const nextHelperAt = input.party === "helper" ? now : helperAt;
      const nextAuthorIp = input.party === "author" ? ip : (ex["author_signer_ip"] as string | null);
      const nextHelperIp = input.party === "helper" ? ip : (ex["helper_signer_ip"] as string | null);
      const nextAuthorSha = input.party === "author" ? manuscriptSha : (ex["author_manuscript_sha256"] as string | null);
      const nextHelperSha = input.party === "helper" ? manuscriptSha : (ex["helper_manuscript_sha256"] as string | null);

      const fully = Boolean(nextAuthorAt && nextHelperAt);
      const patch: Record<string, unknown> = {
        nda_body_snapshot: String(ex["nda_body_snapshot"] || nda_body_snapshot),
        author_signed_at: nextAuthorAt,
        author_signer_ip: nextAuthorIp,
        author_manuscript_sha256: nextAuthorSha,
        helper_signed_at: nextHelperAt,
        helper_signer_ip: nextHelperIp,
        helper_manuscript_sha256: nextHelperSha,
        author_notify_email: (input.authorNotifyEmail?.trim() || ex["author_notify_email"]) as string | null,
        helper_notify_email: (input.helperNotifyEmail?.trim() || ex["helper_notify_email"]) as string | null,
        status: (fully ? "FULLY_EXECUTED" : nextAuthorAt ? "PENDING_HELPER" : "PENDING_AUTHOR") as P4LegalContractStatus,
        executed_at: fully ? (ex["executed_at"] as string | null) ?? now : (ex["executed_at"] as string | null),
        updated_at: now,
      };

      const { data: upd, error: uErr } = await this.supabase
        .from("p4_legal_contracts")
        .update(patch)
        .eq("id", String(ex["id"]))
        .select("*")
        .single();
      if (uErr) throw new Error(`recordDigitalSignature update: ${uErr.message}`);
      row = upd as Record<string, unknown>;
    }

    let out = this.mapContractRow(row);

    if (out.status === "FULLY_EXECUTED" && out.executed_at && !priorReceiptHash) {
      const pdfBytes = await this.buildReceiptOfEngagementPdf(out, title);
      const pdfHash = createHash("sha256").update(Buffer.from(pdfBytes)).digest("hex");
      await this.supabase
        .from("p4_legal_contracts")
        .update({ receipt_pdf_sha256: pdfHash, updated_at: new Date().toISOString() })
        .eq("id", out.id);

      try {
        await dispatchEngagementReceipts({
          authorEmail: out.author_notify_email,
          helperEmail: out.helper_notify_email,
          manuscriptTitle: title,
          contractId: out.id,
          pdfBase64: Buffer.from(pdfBytes).toString("base64"),
        });
        await this.supabase
          .from("p4_legal_contracts")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", out.id);
      } catch {
        /* Webhook/email integration optional — receipt PDF hash is still stored. */
      }
    }

    const { data: fresh } = await this.supabase.from("p4_legal_contracts").select("*").eq("id", out.id).single();
    out = this.mapContractRow((fresh ?? row) as Record<string, unknown>);
    return out;
  }

  private mapContractRow(row: Record<string, unknown>): P4LegalContractRow {
    return {
      id: String(row["id"] ?? ""),
      tenant_id: String(row["tenant_id"] ?? ""),
      manuscript_id: String(row["manuscript_id"] ?? ""),
      helper_id: String(row["helper_id"] ?? ""),
      contract_kind: String(row["contract_kind"] ?? ""),
      template_version: String(row["template_version"] ?? ""),
      nda_body_snapshot: String(row["nda_body_snapshot"] ?? ""),
      status: String(row["status"] ?? "PENDING_AUTHOR") as P4LegalContractStatus,
      author_signed_at: row["author_signed_at"] != null ? String(row["author_signed_at"]) : null,
      author_signer_ip: row["author_signer_ip"] != null ? String(row["author_signer_ip"]) : null,
      author_manuscript_sha256: row["author_manuscript_sha256"] != null ? String(row["author_manuscript_sha256"]) : null,
      helper_signed_at: row["helper_signed_at"] != null ? String(row["helper_signed_at"]) : null,
      helper_signer_ip: row["helper_signer_ip"] != null ? String(row["helper_signer_ip"]) : null,
      helper_manuscript_sha256: row["helper_manuscript_sha256"] != null ? String(row["helper_manuscript_sha256"]) : null,
      executed_at: row["executed_at"] != null ? String(row["executed_at"]) : null,
      author_notify_email: row["author_notify_email"] != null ? String(row["author_notify_email"]) : null,
      helper_notify_email: row["helper_notify_email"] != null ? String(row["helper_notify_email"]) : null,
      receipt_pdf_sha256: row["receipt_pdf_sha256"] != null ? String(row["receipt_pdf_sha256"]) : null,
      email_sent_at: row["email_sent_at"] != null ? String(row["email_sent_at"]) : null,
    };
  }

  /** Receipt PDF (engagement summary + signature hashes). */
  async buildReceiptOfEngagementPdf(contract: P4LegalContractRow, manuscriptTitle: string): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 740;
    const left = 48;
    const line = (text: string, size = 10, f = font, color = rgb(0.12, 0.12, 0.14)) => {
      page.drawText(text.slice(0, 100), { x: left, y, size, font: f, color });
      y -= size + 4;
    };

    page.drawText("Receipt of Engagement — Sovereign NDA", { x: left, y, size: 16, font: bold, color: rgb(0.1, 0.25, 0.45) });
    y -= 26;
    line(`Work: ${manuscriptTitle}`);
    line(`Contract id: ${contract.id}`);
    line(`Manuscript: ${contract.manuscript_id}`);
    line(`Helper: ${contract.helper_id}`);
    line(`Executed (UTC): ${contract.executed_at ?? "—"}`);
    y -= 8;
    line("Author signature block", 11, bold);
    line(`Signed at: ${contract.author_signed_at ?? "—"}`);
    line(`IP: ${contract.author_signer_ip ?? "—"}`);
    line(`Manuscript SHA-256: ${contract.author_manuscript_sha256 ?? "—"}`, 9);
    y -= 6;
    line("Helper / editor signature block", 11, bold);
    line(`Signed at: ${contract.helper_signed_at ?? "—"}`);
    line(`IP: ${contract.helper_signer_ip ?? "—"}`);
    line(`Manuscript SHA-256: ${contract.helper_manuscript_sha256 ?? "—"}`, 9);
    y -= 8;
    line("NDA snapshot (trimmed):", 10, bold);
    const snap = contract.nda_body_snapshot.replace(/\s+/g, " ").trim().slice(0, 2400);
    for (let i = 0; i < snap.length; i += 100) {
      if (y < 80) break;
      line(snap.slice(i, i + 100), 7);
    }
    return doc.save();
  }
}

export type EngagementReceiptEmailPayload = {
  authorEmail: string | null;
  helperEmail: string | null;
  manuscriptTitle: string;
  contractId: string;
  pdfBase64: string;
};

/**
 * Sends receipt PDF to both parties. If `CONTRACT_RECEIPT_EMAIL_WEBHOOK_URL` is set, POSTs JSON there;
 * otherwise no-ops (integrate SendGrid/Resend in that webhook or replace this function).
 */
export async function dispatchEngagementReceipts(payload: EngagementReceiptEmailPayload): Promise<void> {
  const url = process.env.CONTRACT_RECEIPT_EMAIL_WEBHOOK_URL?.trim();
  if (!url) return;
  const body = JSON.stringify({
    kind: "sovereign_nda_receipt",
    ...payload,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(`dispatchEngagementReceipts: webhook HTTP ${res.status}`);
  }
}
