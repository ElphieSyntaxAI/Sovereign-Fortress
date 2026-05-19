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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
/**
 * GET  /api/msgf/education/admin/curriculum-catalog
 *   → district catalog rows + friction-gap recommendations (masterdoc §4.1)
 *
 * POST /api/msgf/education/admin/curriculum-catalog
 *   → admin upserts catalog row (pillars §2.1.4 cross-tenant guardrail)
 *
 * DELETE /api/msgf/education/admin/curriculum-catalog?id=<uuid>
 *   → soft-deactivate (refuses if any active assignment slice references it)
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  CatalogListQuerySchema,
  deactivateCatalogRow,
  listCatalogWithRecommendations,
  upsertCatalogRow,
  type CatalogActor,
} from "@/lib/education/curriculum-catalog";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";
import {
  MSGF_TENANT_ID_HEADER,
  MSGF_TENANT_KEY_HEADER,
} from "@/lib/msgf-http-headers";
import { resolveTenantIdForPillars } from "@/lib/services/msgf-metadata-scope";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyPulseCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

async function resolveActor(req: NextRequest): Promise<CatalogActor> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new EducationPolicyHaltError("Unauthorized.", "EDU_AUTH_REQUIRED");
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const headerTenant =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
    req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
  const districtTenantId = resolveTenantIdForPillars(
    headerTenant || String(meta?.tenant_id ?? "syntax_education"),
    meta
  );
  const role = String(meta?.user_role ?? meta?.persona ?? "student");
  return { role, districtTenantId, userId: user.id };
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const actor = await resolveActor(req);
    const { searchParams } = new URL(req.url);
    const query = CatalogListQuerySchema.parse({
      subjectDomain: searchParams.get("subjectDomain") ?? undefined,
      activeOnly: searchParams.get("activeOnly") !== "false",
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    const admin = createAdminClient();
    const result = await listCatalogWithRecommendations({
      admin,
      districtTenantId: actor.districtTenantId,
      query,
      lookbackDays: searchParams.get("lookbackDays")
        ? Number(searchParams.get("lookbackDays"))
        : 30,
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      district_tenant_id: actor.districtTenantId,
      rows: result.rows,
      hotspots: result.hotspots,
    });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const actor = await resolveActor(req);
    const admin = createAdminClient();
    const rawBody = await req.json();
    const row = await upsertCatalogRow({ admin, actor, input: rawBody });
    return json(req, {
      ok: true,
      trace_id: traceId,
      pillar: "P1",
      district_tenant_id: actor.districtTenantId,
      row,
    });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

export async function DELETE(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const actor = await resolveActor(req);
    const { searchParams } = new URL(req.url);
    const catalogId = searchParams.get("id");
    if (!catalogId) {
      return json(req, { error: "Missing ?id=<uuid>.", trace_id: traceId }, { status: 400 });
    }
    const admin = createAdminClient();
    const row = await deactivateCatalogRow({ admin, actor, catalogId });
    return json(req, { ok: true, trace_id: traceId, row });
  } catch (e) {
    return handleError(req, e, traceId);
  }
}

function handleError(req: NextRequest, e: unknown, traceId: string) {
  if (e instanceof EducationPolicyHaltError) {
    const status =
      e.code === "EDU_AUTH_REQUIRED"
        ? 401
        : e.code === "EDU_CATALOG_NOT_FOUND"
          ? 404
          : 403;
    return json(req, { error: e.message, code: e.code, trace_id: traceId }, { status });
  }
  if (e instanceof ZodError) {
    return json(
      req,
      { error: "Invalid request body", details: e.flatten(), trace_id: traceId },
      { status: 400 }
    );
  }
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api/msgf/education/admin/curriculum-catalog]", e);
  return json(req, { error: message, trace_id: traceId }, { status: 500 });
}
