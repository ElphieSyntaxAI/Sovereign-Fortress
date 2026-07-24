/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * GET/PATCH /api/msgf/workspace/team/readiness — I6 checklist + signing/archive settings
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveOrCreateCompanyForAdmin } from "@/lib/services/company-team";
import {
  getTeamReadiness,
  updateCompanySigningSettings,
} from "@/lib/services/team-readiness";
import {
  assertCanManageTeam,
  requireWorkspaceTeamSession,
} from "@/lib/workspace-team-auth";

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
    const readiness = await getTeamReadiness(session.admin, companyId);
    return NextResponse.json({ ok: true, readiness });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Readiness failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 403 });
  }
}

const patchSchema = z
  .object({
    signing_provider: z.enum(["docusign", "dropbox_sign"]).optional(),
    dropbox_archive_path: z.string().max(512).nullable().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
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
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
    }
    await updateCompanySigningSettings(session.admin, companyId, parsed.data);
    const readiness = await getTeamReadiness(session.admin, companyId);
    return NextResponse.json({ ok: true, readiness });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed.";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
