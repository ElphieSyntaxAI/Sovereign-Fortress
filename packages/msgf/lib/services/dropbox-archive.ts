/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";
import { isProductionDeploy } from "@/lib/deploy-env";

export type DropboxArchiveUploadInput = {
  companyId: string;
  companySlug?: string | null;
  inviteId: string;
  envelopeId?: string | null;
  provider: string;
  /** PDF bytes — optional; mock generates a placeholder buffer. */
  pdfBytes?: Buffer | null;
  audit?: Record<string, unknown>;
};

export type DropboxArchiveUploadResult = {
  dropbox_file_id: string;
  signed_pdf_sha256: string;
  archive_path: string;
  audit_path: string;
  mocked: boolean;
};

export function dropboxArchiveMockMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionDeploy(env)) return false;
  const v = env.MSGF_DROPBOX_ARCHIVE_MOCK?.trim().toLowerCase();
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return !env.DROPBOX_ACCESS_TOKEN?.trim();
}

export function dropboxArchiveRoot(env: NodeJS.ProcessEnv = process.env): string {
  return (env.DROPBOX_ARCHIVE_ROOT?.trim() || "/MSGF-Audit").replace(/\/+$/, "") || "/MSGF-Audit";
}

export function buildDropboxArchiveRelativePath(params: {
  companySlug: string;
  inviteId: string;
  year?: number;
}): { dir: string; pdf: string; audit: string } {
  const yyyy = String(params.year ?? new Date().getUTCFullYear());
  const slug = params.companySlug.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "company";
  const invite = params.inviteId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  const dir = `${slug}/${yyyy}/${invite}`;
  return {
    dir,
    pdf: `${dir}/signed.pdf`,
    audit: `${dir}/audit.json`,
  };
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function mockLocalRoot(): string {
  return path.join(process.cwd(), "tmp", "dropbox-archive");
}

/**
 * Upload signed.pdf + audit.json to Dropbox (or local mock root).
 */
export async function uploadSignedArchive(
  input: DropboxArchiveUploadInput
): Promise<DropboxArchiveUploadResult> {
  const slug =
    input.companySlug?.trim() ||
    input.companyId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) ||
    "company";
  const rel = buildDropboxArchiveRelativePath({
    companySlug: slug,
    inviteId: input.inviteId,
  });
  const root = dropboxArchiveRoot();
  const pdfBytes =
    input.pdfBytes && input.pdfBytes.length > 0
      ? input.pdfBytes
      : Buffer.from(
          `%PDF-1.4\n% MSGF mock signed PDF for invite ${input.inviteId}\n`,
          "utf8"
        );
  const digest = sha256Hex(pdfBytes);
  const auditJson = JSON.stringify(
    {
      invite_id: input.inviteId,
      company_id: input.companyId,
      provider: input.provider,
      envelope_id: input.envelopeId ?? null,
      signed_pdf_sha256: digest,
      archived_at: new Date().toISOString(),
      ...(input.audit ?? {}),
    },
    null,
    2
  );

  if (dropboxArchiveMockMode()) {
    const base = mockLocalRoot();
    const dirAbs = path.join(base, ...rel.dir.split("/"));
    await mkdir(dirAbs, { recursive: true });
    await writeFile(path.join(base, ...rel.pdf.split("/")), pdfBytes);
    await writeFile(path.join(base, ...rel.audit.split("/")), auditJson, "utf8");
    const fileId = `mock-fs:${rel.pdf}`;
    return {
      dropbox_file_id: fileId,
      signed_pdf_sha256: digest,
      archive_path: path.join(base, ...rel.pdf.split("/")),
      audit_path: path.join(base, ...rel.audit.split("/")),
      mocked: true,
    };
  }

  const token = process.env.DROPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("DROPBOX_ACCESS_TOKEN required when mock is off.");
  }

  const dropboxPath = `${root}/${rel.pdf}`.replace(/\/+/g, "/");
  const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body: new Uint8Array(pdfBytes),
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Dropbox PDF upload failed: ${uploadRes.status} ${text.slice(0, 200)}`);
  }
  const uploaded = (await uploadRes.json()) as { id?: string; path_display?: string };

  const auditPath = `${root}/${rel.audit}`.replace(/\/+/g, "/");
  const auditRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: auditPath,
        mode: "overwrite",
        autorename: false,
        mute: true,
      }),
    },
    body: Buffer.from(auditJson, "utf8"),
  });
  if (!auditRes.ok) {
    const text = await auditRes.text().catch(() => "");
    throw new Error(`Dropbox audit upload failed: ${auditRes.status} ${text.slice(0, 200)}`);
  }

  return {
    dropbox_file_id: uploaded.id || dropboxPath,
    signed_pdf_sha256: digest,
    archive_path: uploaded.path_display || dropboxPath,
    audit_path: auditPath,
    mocked: false,
  };
}

/** Persist archive result on envelope + vault log. */
export async function persistArchiveResult(
  admin: SupabaseClient,
  params: {
    companyId: string;
    inviteId: string;
    envelopeId?: string | null;
    result: DropboxArchiveUploadResult;
  }
): Promise<void> {
  if (params.envelopeId) {
    await admin
      .from("msgf_docusign_envelopes")
      .update({
        archive_status: "archived",
        dropbox_file_id: params.result.dropbox_file_id,
        signed_pdf_sha256: params.result.signed_pdf_sha256,
      })
      .eq("id", params.envelopeId);
  }

  await appendVaultLog(admin, params.companyId, "dropbox_archive_completed", {
    invite_id: params.inviteId,
    envelope_id: params.envelopeId ?? null,
    dropbox_file_id: params.result.dropbox_file_id,
    signed_pdf_sha256: params.result.signed_pdf_sha256,
    archive_path: params.result.archive_path,
    mocked: params.result.mocked,
  });
}
