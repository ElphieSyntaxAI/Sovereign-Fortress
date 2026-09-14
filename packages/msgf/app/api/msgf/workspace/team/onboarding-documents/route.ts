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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * POST /api/msgf/workspace/team/onboarding-documents — upload tenant PDF
 * GET  — list company vault documents
 */

import { NextRequest, NextResponse } from "next/server";

import { uploadTenantDocument } from "@/lib/services/tenant-onboarding-vault";
import { resolveOrCreateCompanyForAdmin } from "@/lib/services/company-team";
import {
  assertCanManageTeam,
  requireWorkspaceTeamSession,
} from "@/lib/workspace-team-auth";

const MAX_BYTES = 10 * 1024 * 1024;

export async function GET() {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    assertCanManageTeam(session);
    const companyId = await resolveOrCreateCompanyForAdmin(
      session.admin,
      session.user.id,
      session.companyId,
      session.permissions.isIndependentSandbox
    );
    const { data, error } = await session.admin
      .from("msgf_tenant_vault_documents")
      .select("id, kind, display_name, size_bytes, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, documents: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to list documents." },
      { status: 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    assertCanManageTeam(session);
    const form = await req.formData();
    const file = form.get("file");
    const displayName = String(form.get("display_name") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file is required." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "Only PDF files are allowed." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "File exceeds 10MB limit." }, { status: 400 });
    }

    const companyId = await resolveOrCreateCompanyForAdmin(
      session.admin,
      session.user.id,
      session.companyId,
      session.permissions.isIndependentSandbox
    );

    const doc = await uploadTenantDocument(session.admin, {
      companyId,
      uploadedBy: session.user.id,
      displayName: displayName || file.name,
      fileBytes: bytes,
    });

    return NextResponse.json({ ok: true, document: doc });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Upload failed." },
      { status: 500 }
    );
  }
}
