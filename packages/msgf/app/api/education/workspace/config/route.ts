/**
 * GET /api/education/workspace/config?assignmentId=&entityId=&gradeCohort=
 */
import { NextRequest, NextResponse } from "next/server";

import { resolveEducationWorkspaceConfig } from "@/lib/services/education-workspace-controller";

export async function GET(req: NextRequest) {
  try {
    const assignmentId = req.nextUrl.searchParams.get("assignmentId")?.trim();
    if (!assignmentId) {
      return NextResponse.json(
        { error: "assignmentId is required." },
        { status: 400 }
      );
    }

    const entityId = req.nextUrl.searchParams.get("entityId")?.trim();
    const gradeCohort = req.nextUrl.searchParams.get("gradeCohort")?.trim();

    const config = await resolveEducationWorkspaceConfig({
      assignmentId,
      entityId: entityId || undefined,
      gradeCohort: gradeCohort || undefined,
    });

    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
