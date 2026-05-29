/**
 * POST /api/msgf/workspace/team/invite
 */

import { NextRequest, NextResponse } from "next/server";

import {
  CreateTeamInviteSchema,
  createTeamInvite,
  resolveOrCreateCompanyForAdmin,
} from "@/lib/services/company-team";
import {
  assertCanManageTeam,
  requireWorkspaceTeamSession,
} from "@/lib/workspace-team-auth";

export async function POST(req: NextRequest) {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    assertCanManageTeam(session);
    const json = await req.json();
    const parsed = CreateTeamInviteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const companyId = await resolveOrCreateCompanyForAdmin(
      session.admin,
      session.user.id,
      session.companyId,
      session.permissions.isIndependentSandbox
    );

    const origin = req.nextUrl.origin;
    const redirectTo = `${origin}/reset-password`;

    const result = await createTeamInvite(session.admin, {
      companyId,
      invitedBy: session.user.id,
      email: parsed.data.email,
      teamPlatformRole: parsed.data.team_platform_role,
      projectOrigins: parsed.data.project_origins,
      onboarding: parsed.data.onboarding,
      redirectTo,
    });

    return NextResponse.json({ ok: true, invite_id: result.invite_id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Invite failed." },
      { status: 500 }
    );
  }
}
