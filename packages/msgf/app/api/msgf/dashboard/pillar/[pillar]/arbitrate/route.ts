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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError, assertMsgfServiceAdmin } from "@/lib/msgf-admin-auth";
import {
  applyArbitrationStateMachine,
  hasLiveDashboardDatabaseEnv,
  parsePillarParam,
} from "@/lib/services/dashboard-orchestration";
import {
  MsgfOperatorGateError,
  resolveDashboardOperator,
} from "@/lib/msgf-operator-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

const bodySchema = z.object({
  incident_id: z.string().min(1),
  action: z.enum(["APPROVE_BYPASS", "DENY_PURGE"]),
  source_string: z.string().min(1).max(4000),
});

async function resolveArbitrateActor(req: NextRequest): Promise<{
  actorId: string;
  via: "service_admin" | "dashboard_operator";
}> {
  try {
    assertMsgfServiceAdmin(req);
    return { actorId: "service_admin", via: "service_admin" };
  } catch (e) {
    if (!(e instanceof MsgfAdminAuthError) || e.status === 500) throw e;
  }

  const cookieStore = await cookies();
  const hdrs = req.headers;
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new MsgfAdminAuthError("Sign in required for Human Arbitrate.", 401);
  }

  const admin = createAdminClient();
  const op = await resolveDashboardOperator(req, admin);
  if (op.role === "DEVELOPER") {
    throw new MsgfAdminAuthError(
      "Human Arbitrate requires company or global operator access.",
      403
    );
  }

  return { actorId: user.id, via: "dashboard_operator" };
}

export async function POST(
  req: NextRequest,
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

  try {
    const actor = await resolveArbitrateActor(req);
    const live = hasLiveDashboardDatabaseEnv();
    const admin = live ? createAdminClient() : undefined;

    const result = await applyArbitrationStateMachine({
      supabase: admin,
      action: parsed.data.action,
      incidentId: parsed.data.incident_id,
      sourceString: parsed.data.source_string,
      actorId: actor.actorId,
      tenantId: "global_dashboard",
    });

    return NextResponse.json({
      ...result,
      source: live ? "live" : "mock",
      actor_via: actor.via,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    if (e instanceof MsgfOperatorGateError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Arbitration failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
