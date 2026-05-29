/**
 * GET /api/msgf/workspace/team/roster
 */

import { NextResponse } from "next/server";

import { listTeamRoster, resolveOrCreateCompanyForAdmin } from "@/lib/services/company-team";
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
    const roster = await listTeamRoster(session.admin, companyId);
    return NextResponse.json({ ok: true, roster });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to load roster." },
      { status: 403 }
    );
  }
}
