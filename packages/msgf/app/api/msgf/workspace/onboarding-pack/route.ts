/**
 * GET /api/msgf/workspace/onboarding-pack
 */

import { NextResponse } from "next/server";

import { listUserOnboardingPack } from "@/lib/services/tenant-onboarding-vault";
import { requireWorkspaceTeamSession } from "@/lib/workspace-team-auth";

export async function GET() {
  const session = await requireWorkspaceTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    const pack = await listUserOnboardingPack(session.admin, session.user.id);
    return NextResponse.json({ ok: true, documents: pack ?? [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to load pack." },
      { status: 500 }
    );
  }
}
