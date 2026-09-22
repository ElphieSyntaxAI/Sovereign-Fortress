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
