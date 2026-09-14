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
import { NextResponse } from "next/server";

import { HelperProofService, type HelperMilestoneType } from "../../../../../../apps/author-ecosystem/server/src/lib/HelperProofService";
import { createServiceRoleClient } from "@msgf/lib/supabase/service-role";

const MILESTONES: HelperMilestoneType[] = ["SEED", "GROWTH", "HARVEST"];

function parseMilestone(v: unknown): HelperMilestoneType | null {
  const s = typeof v === "string" ? v.trim().toUpperCase() : "";
  return MILESTONES.includes(s as HelperMilestoneType) ? (s as HelperMilestoneType) : null;
}

/**
 * POST /api/helper/milestone
 * Body: { project_id: string (manuscript id), milestone_type: SEED|GROWTH|HARVEST, file_url: string }
 *
 * Secured with `Authorization: Bearer <HELPER_API_SECRET>` (trusted helper worker / bridge).
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
  const milestone_type = parseMilestone(o["milestone_type"]);
  const file_url = typeof o["file_url"] === "string" ? o["file_url"].trim() : "";

  if (!project_id) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }
  if (!milestone_type) {
    return NextResponse.json({ error: "milestone_type must be SEED, GROWTH, or HARVEST" }, { status: 400 });
  }
  if (!file_url) {
    return NextResponse.json({ error: "file_url is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const row = await new HelperProofService(supabase).recordMilestone({
      projectId: project_id,
      milestoneType: milestone_type,
      fileUrl: file_url,
    });
    return NextResponse.json({ milestone: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
