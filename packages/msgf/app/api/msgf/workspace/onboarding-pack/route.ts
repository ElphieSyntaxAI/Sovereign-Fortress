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
