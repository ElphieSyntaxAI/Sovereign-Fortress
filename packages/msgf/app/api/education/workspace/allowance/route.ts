/**
 * PATCH /api/education/workspace/allowance — teacher updates Layer B on the fly.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAiAllowanceLevel } from "@elphie-syntax/core";

import { updateAssignmentAllowance } from "@/lib/services/education-workspace-controller";

const PatchBodySchema = z.object({
  assignmentId: z.string().uuid(),
  aiAllowanceLevel: z.number().int().min(0).max(4),
  updatedBy: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = PatchBodySchema.parse(await req.json());
    if (!isAiAllowanceLevel(body.aiAllowanceLevel)) {
      return NextResponse.json(
        { error: "aiAllowanceLevel must be 0–4." },
        { status: 400 }
      );
    }

    const config = await updateAssignmentAllowance({
      assignmentId: body.assignmentId,
      aiAllowanceLevel: body.aiAllowanceLevel,
      updatedBy: body.updatedBy,
    });

    return NextResponse.json({
      ok: true,
      layerB: config.layerB,
      layerA: config.layerA,
      assignmentId: config.assignmentId,
      broadcast: "layer_b_allowance_updated",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid body", details: e.flatten() },
        { status: 400 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
