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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * GET /api/msgf/education/teacher/curriculum-catalog
 * Active district titles for the lesson builder (teachers may read; not mutate).
 */
import { randomUUID } from "crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  CatalogListQuerySchema,
  listCatalog,
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

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const headerTenant =
      req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() ||
      req.headers.get(MSGF_TENANT_ID_HEADER)?.trim();
    const openApi = process.env.EDUCATION_OPEN_LESSON_API === "1";

    if (!user && !openApi) {
      throw new EducationPolicyHaltError("Unauthorized.", "EDU_AUTH_REQUIRED");
    }

    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const tenantId = resolveTenantIdForPillars(
      headerTenant || String(meta?.tenant_id ?? "syntax_education"),
      meta
    );

    const { searchParams } = new URL(req.url);
    const query = CatalogListQuerySchema.parse({
      subjectDomain: searchParams.get("subjectDomain") ?? undefined,
      gradeBand: searchParams.get("gradeBand") ?? undefined,
      activeOnly: searchParams.get("activeOnly") !== "false",
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    const admin = createAdminClient();
    const rows = await listCatalog({
      admin,
      districtTenantId: tenantId,
      query,
    });

    return json(req, {
      ok: true,
      trace_id: traceId,
      district_tenant_id: tenantId,
      rows,
    });
  } catch (e) {
    if (e instanceof EducationPolicyHaltError) {
      return json(
        req,
        { ok: false, error: e.message, code: e.code, trace_id: traceId },
        { status: 403 }
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return json(req, { ok: false, error: message, trace_id: traceId }, { status: 400 });
  }
}
