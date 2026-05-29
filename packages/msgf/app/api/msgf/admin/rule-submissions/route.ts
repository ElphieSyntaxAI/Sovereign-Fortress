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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveDashboardOperator } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { MitigationActionSchema } from "@/lib/schemas/mitigation-action";
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";
import {
  insertRuleGlobalReviewSubmission,
  listCompanyRuleGlobalReviewSubmissions,
  listPendingRuleGlobalReviewSubmissions,
  toProposedBrainUpdatePublicDto,
} from "@/lib/services/msgf-rule-submissions";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

const postBodySchema = z.object({
  tenant_id: z.string().min(1),
  bug_index: GenealogicalBugIndexSchema,
  mitigation_action: MitigationActionSchema,
  human_reasoning: z.string().max(8000).optional(),
  final_fix_applied: z.string().max(8000).optional(),
  human_note: z.string().max(4000).optional(),
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * POST /api/msgf/admin/rule-submissions
 * Company admin: enqueue a LOCAL/Global-Fix-shaped mitigation for platform GLOBAL review.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role !== "COMPANY_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Only company admins can submit rules for global review." },
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

    if (!op.operatorUserId) {
      return adminJson(
        req,
        { ok: false, error: "Company admin submissions require MSGF-Operator-User-Id header." },
        { status: 400 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return adminJson(req, { ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = postBodySchema.safeParse(json);
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.mitigation_action.kind !== "Global Fix") {
      return adminJson(
        req,
        { ok: false, error: "mitigation_action.kind must be Global Fix for global review submission." },
        { status: 400 }
      );
    }

    const submitted = await insertRuleGlobalReviewSubmission(admin, {
      tenantId: parsed.data.tenant_id,
      companyId: op.companyId,
      submittedByActorId: op.operatorUserId,
      mitigationSnapshot: {
        bug_index: parsed.data.bug_index,
        mitigation_action: parsed.data.mitigation_action,
        human_reasoning: parsed.data.human_reasoning,
        final_fix_applied: parsed.data.final_fix_applied,
      },
      humanNote: parsed.data.human_note,
    });

    return adminJson(req, { ok: true, submission_id: submitted.id });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to submit rule for global review.";
    console.error("[admin/rule-submissions] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}

/**
 * GET /api/msgf/admin/rule-submissions
 * Global admin: pending queue. Company admin: this company's submissions.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Developers cannot list rule submissions." }, { status: 403 });
    }

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const q = querySchema.safeParse(raw);
    if (!q.success) {
      return adminJson(req, { ok: false, error: q.error.flatten() }, { status: 400 });
    }

    const limit = q.data.limit ?? 50;

    if (op.role === "GLOBAL_ADMIN") {
      const submissions = await listPendingRuleGlobalReviewSubmissions(admin, limit);
      const proposed_brain_updates = submissions.map(toProposedBrainUpdatePublicDto);
      return adminJson(req, {
        ok: true,
        scope: "pending_global",
        count: proposed_brain_updates.length,
        proposed_brain_updates,
      });
    }

    if (op.role === "COMPANY_ADMIN") {
      if (!op.companyId) {
        return adminJson(
          req,
          { ok: false, error: "Company admin requires company_id on p4_profiles." },
          { status: 403 }
        );
      }
      const submissions = await listCompanyRuleGlobalReviewSubmissions(admin, op.companyId, limit);
      return adminJson(req, { ok: true, scope: "company", count: submissions.length, submissions });
    }

    return adminJson(req, { ok: false, error: "Unsupported role." }, { status: 403 });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to list rule submissions.";
    console.error("[admin/rule-submissions] GET", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
