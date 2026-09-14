/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * POST /api/msgf/governance/resource-usage
 * Sister-app non-blocking usage emit (Author / Educates). Auth: gateway license key.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  authenticateGatewayKey,
  extractMsgfKeyFromRequest,
  GatewayAuthError,
} from "@/lib/gateway/auth";
import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";
import { emitResourceUsage } from "@/lib/services/emit-resource-usage";
import { MSGF_TENANT_ID_HEADER } from "@/lib/msgf-http-headers";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const key = extractMsgfKeyFromRequest(req);
    const tenantHint = req.headers.get(MSGF_TENANT_ID_HEADER);
    const auth = await authenticateGatewayKey(key, tenantHint, req);
    const admin = createAdminClient();
    const body = (await req.json()) as {
      kind?: string;
      resource_key?: string;
      product?: string;
      project_origin?: string;
      trace_id?: string;
      query_text?: string;
      content_hash?: string;
    };

    if (!body.resource_key?.trim()) {
      return NextResponse.json({ ok: false, error: "resource_key required" }, { status: 400 });
    }

    const kind = (body.kind ?? "citation") as
      | "vault"
      | "hall"
      | "file"
      | "tool"
      | "search"
      | "mcp"
      | "agent"
      | "citation"
      | "pack";

    emitResourceUsage(admin, {
      tenant_id: auth.tenantId,
      product: (body.product as "author" | "educates" | "msgf") || "author",
      kind,
      resource_key: body.resource_key.trim(),
      project_origin: body.project_origin ?? null,
      trace_id: body.trace_id ?? null,
      query_text: body.query_text ?? null,
      content_hash: body.content_hash ?? null,
    });

    emitPlatformAudit(admin, {
      product: body.product || "author",
      tenant_id: auth.tenantId,
      kind: "resource_usage_emit",
      severity: "info",
      trace_id: body.trace_id ?? null,
      summary: `Resource usage ${kind}: ${body.resource_key.trim().slice(0, 120)}`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GatewayAuthError) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: e.status }
      );
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "emit failed" },
      { status: 500 }
    );
  }
}

