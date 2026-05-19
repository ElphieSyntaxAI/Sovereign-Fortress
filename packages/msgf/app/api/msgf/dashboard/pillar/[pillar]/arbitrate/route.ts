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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyArbitrationStateMachine,
  hasLiveDashboardDatabaseEnv,
  parsePillarParam,
} from "@/lib/services/dashboard-orchestration";
import { createAdminClient } from "@/utils/supabase/admin";

const bodySchema = z.object({
  incident_id: z.string().min(1),
  action: z.enum(["APPROVE_BYPASS", "DENY_PURGE"]),
  source_string: z.string().min(1).max(4000),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ pillar: string }> }
) {
  await context.params.then((params) => parsePillarParam(params.pillar));
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const live = hasLiveDashboardDatabaseEnv();
  const result = await applyArbitrationStateMachine({
    supabase: live ? createAdminClient() : undefined,
    action: parsed.data.action,
    incidentId: parsed.data.incident_id,
    sourceString: parsed.data.source_string,
    tenantId: "global_dashboard",
  });

  return NextResponse.json({
    ...result,
    source: live ? "live" : "mock",
  });
}
