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
 * Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { listPendingGlobalPromotions } from "@/lib/services/global-promotion";
import { redactProjectSensitiveText } from "@/lib/services/logic-pattern-sanitize";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const querySchema = z.object({
  tenant_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * GET /api/msgf/admin/promotions/pending
 * Lists dev-submitted LogicDeltas awaiting vault_core promotion (admin Bearer only).
 */
export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot list pending global promotions." },
        { status: 403 }
      );
    }

    if (op.role === "COMPANY_ADMIN" && !op.companyId) {
      return adminJson(
        req,
        { ok: false, error: "Company admin requires company_id on p4_profiles." },
        { status: 403 }
      );
    }

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const q = querySchema.safeParse(raw);
    if (!q.success) {
      return adminJson(req, { ok: false, error: q.error.flatten() }, { status: 400 });
    }

    const entries = await listPendingGlobalPromotions({
      adminSupabase: admin,
      limit: q.data.limit,
      tenantId: q.data.tenant_id,
      companyId: op.role === "COMPANY_ADMIN" ? op.companyId ?? undefined : undefined,
      queue: op.role === "COMPANY_ADMIN" ? "company_validation" : "vault_promotion",
    });

    const isGlobal = op.role === "GLOBAL_ADMIN";

    return adminJson(req, {
      ok: true,
      count: entries.length,
      queue_mode: isGlobal ? "vault_promotion" : "company_validation",
      entries: entries.map((e) => ({
        id: e.id,
        tenant_id: e.tenant_id,
        entity_id: e.entity_id,
        suggested_by_entity_id: e.entity_id,
        suggested_by_tenant_id: e.tenant_id,
        promotion_status: e.promotion_status,
        created_at: e.created_at,
        expires_at: e.expires_at,
        company_validated_at: e.company_validated_at ?? null,
        preview: {
          summary_beat: (e.delta_payload?.summary_beat as string | undefined) ?? null,
          source: (e.delta_payload?.source as string | undefined) ?? null,
          content_snippet: (() => {
            const raw = String(e.delta_payload?.content ?? "").slice(0, 280);
            return isGlobal ? redactProjectSensitiveText(raw) : raw;
          })(),
        },
      })),
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to list pending promotions.";
    console.error("[admin/promotions/pending] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
