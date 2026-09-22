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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import {
  approveRuleGlobalReviewSubmission,
  rejectRuleGlobalReviewSubmission,
  withdrawRuleGlobalReviewSubmission,
} from "@/lib/services/msgf-rule-submissions";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const patchBodySchema = z.object({
  action: z.enum(["approve", "reject", "withdraw"]),
  reviewer_note: z.string().max(4000).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * PATCH /api/msgf/admin/rule-submissions/:id
 * Global admin: approve (promotes to platform GLOBAL rules) or reject.
 * Company admin: withdraw pending submission for their company.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await ctx.params;
    if (!submissionId?.trim()) {
      return adminJson(req, { ok: false, error: "submission id required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = patchBodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.action === "withdraw") {
      if (op.role !== "COMPANY_ADMIN") {
        return adminJson(
          req,
          { ok: false, error: "Only company admins can withdraw submissions." },
          { status: 403 }
        );
      }
      if (!op.companyId) {
        return adminJson(
          req,
          { ok: false, error: "Company admin requires company_id on p4_profiles." },
          { status: 403 }
        );
      }
      await withdrawRuleGlobalReviewSubmission(admin, {
        submissionId,
        companyId: op.companyId,
      });
      return adminJson(req, { ok: true, status: "withdrawn" });
    }

    if (op.role !== "GLOBAL_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Approving or rejecting submissions requires a global operator." },
        { status: 403 }
      );
    }

    if (parsed.data.action === "approve") {
      const result = await approveRuleGlobalReviewSubmission(admin, {
        submissionId,
        reviewerActorId: op.operatorUserId,
        reviewerNote: parsed.data.reviewer_note,
      });
      return adminJson(req, {
        ok: true,
        status: "approved",
        global_mitigation_id: result.mitigationId,
        global_rules_updated: result.ruleUpdated,
        lineage_keys_invalidated: result.lineage_keys_invalidated,
        global_promotion_status: result.promotion_status,
        submission_id: result.submission_id,
        ...(result.local_cache_id ? { local_cache_id: result.local_cache_id } : {}),
      });
    }

    await rejectRuleGlobalReviewSubmission(admin, {
      submissionId,
      reviewerActorId: op.operatorUserId,
      reviewerNote: parsed.data.reviewer_note,
    });
    return adminJson(req, { ok: true, status: "rejected" });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to update submission.";
    console.error("[admin/rule-submissions/:id] PATCH", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
