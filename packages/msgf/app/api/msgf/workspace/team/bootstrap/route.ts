/**
 * POST /api/msgf/workspace/team/bootstrap — apply invite metadata after password set
 */

import { NextResponse } from "next/server";

import { applyTeamInviteBootstrap } from "@/lib/services/company-team";
import { requireWorkspaceTeamSession } from "@/lib/workspace-team-auth";

export async function POST() {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    const result = await applyTeamInviteBootstrap(session.admin, session.user);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Bootstrap failed." },
      { status: 500 }
    );
  }
}
