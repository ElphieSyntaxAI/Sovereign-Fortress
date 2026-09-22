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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  addCompanyDomain,
  listCompanyDomains,
} from "@/lib/services/company-domains";
import {
  assertCanManageTeam,
  requireWorkspaceTeamSession,
} from "@/lib/workspace-team-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  if (!session.companyId) {
    return NextResponse.json({ ok: false, error: "No company on profile." }, { status: 403 });
  }

  try {
    assertCanManageTeam(session);
  } catch {
    return NextResponse.json({ ok: false, error: "Company admin required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const domains = await listCompanyDomains(admin, session.companyId);
  return NextResponse.json({ ok: true, company_id: session.companyId, domains });
}

const postSchema = z.object({ domain: z.string().min(3).max(255) }).strict();

export async function POST(req: NextRequest) {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  if (!session.companyId) {
    return NextResponse.json({ ok: false, error: "No company on profile." }, { status: 403 });
  }

  try {
    assertCanManageTeam(session);
  } catch {
    return NextResponse.json({ ok: false, error: "Company admin required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const row = await addCompanyDomain(admin, session.companyId, parsed.data.domain);
    return NextResponse.json({ ok: true, domain: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Add domain failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
