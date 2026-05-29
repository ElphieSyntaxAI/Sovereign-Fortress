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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { listVaultLawBookExcerpts } from "@/lib/services/context-loader";
import { MSGF_VAULT_CORE_TENANT_ID } from "@/lib/services/global-approval-gate";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const querySchema = z.object({
  book: z.enum(["local", "global"]).optional(),
  tenant_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * GET /api/msgf/admin/law-book
 *
 * - **local** (`tenant_vault`): tenant-scoped vault excerpts. COMPANY_ADMIN may **only** use this.
 * - **global** (`global_vault`): core Hall excerpts under vault_core. GLOBAL_ADMIN only.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot read the Law Book API." },
        { status: 403 }
      );
    }

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const q = querySchema.safeParse(raw);
    if (!q.success) {
      return adminJson(req, { ok: false, error: q.error.flatten() }, { status: 400 });
    }

    const book = q.data.book ?? "local";
    const limit = q.data.limit ?? 40;

    if (op.role === "COMPANY_ADMIN") {
      if (book !== "local") {
        return adminJson(
          req,
          {
            ok: false,
            error: "Company operators may only read the Local Law Book (tenant_vault).",
          },
          { status: 403 }
        );
      }
      const tenantId = q.data.tenant_id?.trim();
      if (!tenantId) {
        return adminJson(
          req,
          { ok: false, error: "tenant_id is required for the Local Law Book." },
          { status: 400 }
        );
      }
      const excerpts = await listVaultLawBookExcerpts(admin, tenantId, { limit });
      return adminJson(req, {
        ok: true,
        book: "local",
        law_book: "tenant_vault",
        count: excerpts.length,
        excerpts,
      });
    }

    if (op.role !== "GLOBAL_ADMIN") {
      return adminJson(req, { ok: false, error: "Unsupported operator role." }, { status: 403 });
    }

    if (book === "global") {
      const excerpts = await listVaultLawBookExcerpts(admin, MSGF_VAULT_CORE_TENANT_ID, {
        limit,
      });
      return adminJson(req, {
        ok: true,
        book: "global",
        law_book: "global_vault",
        count: excerpts.length,
        excerpts,
      });
    }

    const tenantId = q.data.tenant_id?.trim();
    if (!tenantId) {
      return adminJson(
        req,
        { ok: false, error: "tenant_id is required when book=local." },
        { status: 400 }
      );
    }
    const excerpts = await listVaultLawBookExcerpts(admin, tenantId, { limit });
    return adminJson(req, {
      ok: true,
      book: "local",
      law_book: "tenant_vault",
      count: excerpts.length,
      excerpts,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to load Law Book.";
    console.error("[admin/law-book] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
