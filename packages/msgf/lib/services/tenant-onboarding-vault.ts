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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Tenant vault onboarding documents — encrypted storage + grants.
 */

import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PILLAR_GUIDE_ENTRIES } from "@/lib/pillar-guide-copy";

const VAULT_BUCKET = "tenant-vault";

export type VaultDocumentKind =
  | "custom_pdf"
  | "pillar_guide"
  | "architecture_template"
  | "docusign_completed";

export type OnboardingDocumentMeta = {
  id: string;
  kind: VaultDocumentKind;
  display_name: string;
  granted_at: string;
  viewed_at: string | null;
};

export type OnboardingBundleInput = {
  include_pillar_guide: boolean;
  include_architecture_template: boolean;
  enforce_docusign: boolean;
  custom_document_ids: string[];
};

function digestBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function appendVaultLog(
  admin: SupabaseClient,
  companyId: string,
  kind: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("msgf_tenant_vault_log").insert({
    company_id: companyId,
    kind,
    payload,
  });
  if (error) throw new Error(`appendVaultLog: ${error.message}`);
}

export async function uploadTenantDocument(
  admin: SupabaseClient,
  params: {
    companyId: string;
    uploadedBy: string;
    displayName: string;
    fileBytes: Buffer;
  }
): Promise<{ id: string; display_name: string }> {
  const docId = crypto.randomUUID();
  const safeName = params.displayName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath = `${params.companyId}/${docId}/${safeName}`;

  const { error: uploadErr } = await admin.storage
    .from(VAULT_BUCKET)
    .upload(storagePath, params.fileBytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`vault upload failed: ${uploadErr.message}`);
  }

  const { data, error } = await admin
    .from("msgf_tenant_vault_documents")
    .insert({
      id: docId,
      company_id: params.companyId,
      kind: "custom_pdf",
      display_name: params.displayName,
      storage_path: storagePath,
      content_digest: digestBuffer(params.fileBytes),
      size_bytes: params.fileBytes.length,
      uploaded_by: params.uploadedBy,
    })
    .select("id, display_name")
    .single();

  if (error) throw new Error(`vault document row: ${error.message}`);
  return data as { id: string; display_name: string };
}

export async function ensureStandardVaultAsset(
  admin: SupabaseClient,
  companyId: string,
  kind: "pillar_guide" | "architecture_template",
  uploadedBy: string
): Promise<string> {
  const { data: existing } = await admin
    .from("msgf_tenant_vault_documents")
    .select("id")
    .eq("company_id", companyId)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  let displayName: string;
  let content: string;

  if (kind === "pillar_guide") {
    displayName = "Core Pillar Guide";
    content = PILLAR_GUIDE_ENTRIES.map(
      (e) => `## ${e.pillar} — ${e.title}\n${e.whatItDoes}\n`
    ).join("\n");
  } else {
    displayName = "Architecture Best Practices Template";
    content =
      "MSGF Architecture Best Practices\n\n" +
      "1. Map one project_origin per app workspace.\n" +
      "2. Mint long-lived IDE tokens per origin.\n" +
      "3. Run shadow scan before CONVERGE.\n";
  }

  const bytes = Buffer.from(content, "utf8");
  const docId = crypto.randomUUID();
  const storagePath = `${companyId}/${docId}/${kind}.pdf`;

  await admin.storage.from(VAULT_BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  const { data, error } = await admin
    .from("msgf_tenant_vault_documents")
    .insert({
      id: docId,
      company_id: companyId,
      kind,
      display_name: displayName,
      storage_path: storagePath,
      content_digest: digestBuffer(bytes),
      size_bytes: bytes.length,
      uploaded_by: uploadedBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(`ensureStandardVaultAsset: ${error.message}`);
  return String(data.id);
}

export async function createInviteBundle(
  admin: SupabaseClient,
  inviteId: string,
  bundle: OnboardingBundleInput
): Promise<void> {
  const { error } = await admin.from("msgf_invite_onboarding_bundles").insert({
    invite_id: inviteId,
    include_pillar_guide: bundle.include_pillar_guide,
    include_architecture_template: bundle.include_architecture_template,
    enforce_docusign: bundle.enforce_docusign,
    custom_document_ids: bundle.custom_document_ids ?? [],
  });
  if (error) throw new Error(`createInviteBundle: ${error.message}`);
}

export async function grantDocumentsToUser(
  admin: SupabaseClient,
  params: {
    userId: string;
    inviteId: string;
    companyId: string;
    bundle: OnboardingBundleInput;
    invitedBy: string;
  }
): Promise<string[]> {
  const docIds: string[] = [...(params.bundle.custom_document_ids ?? [])];

  if (params.bundle.include_pillar_guide) {
    docIds.push(
      await ensureStandardVaultAsset(admin, params.companyId, "pillar_guide", params.invitedBy)
    );
  }
  if (params.bundle.include_architecture_template) {
    docIds.push(
      await ensureStandardVaultAsset(
        admin,
        params.companyId,
        "architecture_template",
        params.invitedBy
      )
    );
  }

  const unique = [...new Set(docIds)];
  for (const documentId of unique) {
    await admin.from("msgf_user_onboarding_grants").upsert(
      {
        user_id: params.userId,
        document_id: documentId,
        invite_id: params.inviteId,
      },
      { onConflict: "user_id,document_id" }
    );
  }

  await appendVaultLog(admin, params.companyId, "onboarding_grant", {
    user_id: params.userId,
    invite_id: params.inviteId,
    document_ids: unique,
  });

  return unique;
}

export async function listUserOnboardingPack(
  admin: SupabaseClient,
  userId: string
): Promise<OnboardingDocumentMeta[]> {
  const { data, error } = await admin
    .from("msgf_user_onboarding_grants")
    .select(
      "granted_at, viewed_at, document:msgf_tenant_vault_documents(id, kind, display_name)"
    )
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });

  if (error) throw new Error(`listUserOnboardingPack: ${error.message}`);

  return (data ?? []).flatMap((row) => {
    const doc = row.document as
      | { id: string; kind: VaultDocumentKind; display_name: string }
      | { id: string; kind: VaultDocumentKind; display_name: string }[]
      | null;
    const d = Array.isArray(doc) ? doc[0] : doc;
    if (!d?.id) return [];
    return [
      {
        id: d.id,
        kind: d.kind,
        display_name: d.display_name,
        granted_at: row.granted_at as string,
        viewed_at: (row.viewed_at as string | null) ?? null,
      },
    ];
  });
}

export async function createSignedDownloadUrl(
  admin: SupabaseClient,
  userId: string,
  documentId: string
): Promise<string | null> {
  const { data: grant } = await admin
    .from("msgf_user_onboarding_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .maybeSingle();

  if (!grant) return null;

  const { data: doc } = await admin
    .from("msgf_tenant_vault_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc?.storage_path) return null;

  const { data: signed, error } = await admin.storage
    .from(VAULT_BUCKET)
    .createSignedUrl(doc.storage_path as string, 300);

  if (error || !signed?.signedUrl) return null;

  await admin
    .from("msgf_user_onboarding_grants")
    .update({ viewed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .is("viewed_at", null);

  return signed.signedUrl;
}
