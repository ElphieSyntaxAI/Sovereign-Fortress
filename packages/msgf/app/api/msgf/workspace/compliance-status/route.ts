/**
 * GET /api/msgf/workspace/compliance-status
 */

import { NextResponse } from "next/server";

import { getComplianceStatus } from "@/lib/services/company-team";
import { requireWorkspaceTeamSession } from "@/lib/workspace-team-auth";

export async function GET() {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    const status = await getComplianceStatus(session.admin, session.user.id);
    return NextResponse.json({
      ok: true,
      ...status,
      team_platform_role: session.teamPlatformRole,
      permissions: {
        isDocuSignLocked: session.permissions.isDocuSignLocked,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 }
    );
  }
}
