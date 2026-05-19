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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { buildGlobalInsightFeed } from "@/lib/services/global-insight";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const querySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional(),
  scan: z.coerce.number().int().min(10).max(800).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * GET /api/msgf/admin/global-insight/feed
 * GLOBAL_ADMIN — anonymized successful local heals across tenants.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role !== "GLOBAL_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Global Insight is restricted to global operators." },
        { status: 403 }
      );
    }

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const q = querySchema.safeParse(raw);
    if (!q.success) {
      return adminJson(req, { ok: false, error: q.error.flatten() }, { status: 400 });
    }

    const insights = await buildGlobalInsightFeed(admin, {
      take: q.data.take,
      scanLimit: q.data.scan,
    });

    return adminJson(req, { ok: true, count: insights.length, insights });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to load Global Insight feed.";
    console.error("[admin/global-insight/feed] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
