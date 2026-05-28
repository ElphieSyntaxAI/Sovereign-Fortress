/**
 * GET /api/msgf/agent-context?tenant_id=&mode=guided|auto&file_paths=a,b
 */

import { NextRequest, NextResponse } from "next/server";

import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { AgentContextQuerySchema } from "@/lib/schemas/report-issue";
import { parseHealQueueTenantQuery } from "@/lib/schemas/heal-queue";
import { buildAgentContextPack } from "@/lib/services/agent-context-service";
import { listHealQueueRemediationTasks } from "@/lib/services/heal-queue-service";
import { createAdminClient } from "@/utils/supabase/admin";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const tenantParsed = parseHealQueueTenantQuery(sp.get("tenant_id"));
    const queryParsed = AgentContextQuerySchema.safeParse({
      tenant_id: tenantParsed.tenant_id,
      mode: sp.get("mode") ?? "guided",
      file_paths: sp.get("file_paths") ?? undefined,
      trigger_label: sp.get("trigger_label") ?? undefined,
    });

    if (!queryParsed.success) {
      return json(
        req,
        { ok: false, error: queryParsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { tenant_id, mode, file_paths: pathsRaw, trigger_label } = queryParsed.data;
    const file_paths = pathsRaw
      ? pathsRaw
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : undefined;

    const admin = createAdminClient();
    const entityId =
      req.headers.get("x-msgf-entity-id")?.trim() ||
      process.env.MSGF_SOLO_ENTITY_ID?.trim() ||
      tenant_id;

    const listed = await listHealQueueRemediationTasks(admin, tenant_id, entityId);
    const brain_summary = `Brain ${listed.brain_readiness.readiness_score}% · missing ${
      listed.brain_readiness.missing_pillars.join(", ") || "none"
    }`;

    const pack = buildAgentContextPack({
      mode,
      tenant_id,
      tasks: listed.remediation_tasks,
      file_paths,
      brain_summary,
      trigger_label: trigger_label ?? null,
    });

    return json(req, { ok: true, ...pack });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "agent-context failed";
    console.error("[agent-context]", e);
    return json(req, { ok: false, error: msg }, { status: 500 });
  }
}
