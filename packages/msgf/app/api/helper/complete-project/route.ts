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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
 */
import { NextResponse } from "next/server";

import { HelperProofService } from "../../../../../../apps/author-ecosystem/server/src/lib/HelperProofService";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";

/**
 * POST /api/helper/complete-project
 * Body: { project_id: string } (manuscript id)
 *
 * Gate for Helper "Complete project": returns 403 until SEED, GROWTH, and HARVEST milestones exist.
 * Secured with `Authorization: Bearer <HELPER_API_SECRET>`.
 */
export async function POST(req: Request) {
  const secret = process.env.HELPER_API_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "HELPER_API_SECRET is not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const project_id = typeof o["project_id"] === "string" ? o["project_id"].trim() : "";

  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const gate = await new HelperProofService(supabase).validateHelperCanCompleteProject(project_id);
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: "Milestones incomplete",
          missing_milestone_types: gate.missing_milestone_types,
          message: gate.message,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, allowed: true, message: gate.message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
