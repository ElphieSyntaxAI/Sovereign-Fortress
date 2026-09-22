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
 * POST /api/msgf/admin/incidents/bulk-resolve
 * Trusted OSS bulk-triage — one A6 row per incident via resolveAdminIncident.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { resolveAdminIncident } from "@/lib/services/admin-incident-resolve";
import { getMsgfIncidentById } from "@/lib/services/msgf-incidents";
import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";
import {
  evaluateTrustedOssEligibility,
  loadTrustedLicenseAllowlist,
} from "@/lib/services/trusted-license-allowlist";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  return applyAdminCorsHeaders(req, NextResponse.json(data, init));
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

const BodySchema = z.object({
  incident_ids: z.array(z.string().uuid()).min(1).max(50),
  operator_note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);
    if (op.role === "DEVELOPER") {
      return adminJson(req, { ok: false, error: "Forbidden" }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return adminJson(
        req,
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const allowlist = await loadTrustedLicenseAllowlist(admin, {
      company_id: op.companyId,
    });

    const approved: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of parsed.data.incident_ids) {
      try {
        const incident = await getMsgfIncidentById({ adminSupabase: admin, id });
        if (!incident) {
          skipped.push({ id, reason: "not_found" });
          continue;
        }
        if (incident.status !== "pending") {
          skipped.push({ id, reason: "not_pending" });
          continue;
        }

        const eligibility = evaluateTrustedOssEligibility(
          incident.metadata ?? null,
          allowlist
        );
        if (!eligibility.eligible) {
          skipped.push({ id, reason: eligibility.reason });
          continue;
        }

        const note =
          parsed.data.operator_note?.trim() ||
          `TRUSTED_OSS_BULK_APPROVE: ${eligibility.reason}`;

        const result = await resolveAdminIncident({
          adminSupabase: admin,
          incidentId: id,
          operator: op,
          body: {
            status: "resolved",
            resolution_note: note,
            remediation_strategy_label: "trusted_oss_bulk_triage",
            human_reasoning: `Bulk triage allowlist path. ${eligibility.reason}`,
            final_fix_applied: "Allowlisted permissive OSS — no code delta required.",
          },
        });

        approved.push(id);
        emitPlatformAudit(admin, {
          product: "msgf",
          tenant_id:
            typeof incident.metadata?.tenant_id === "string"
              ? incident.metadata.tenant_id
              : incident.user_id,
          company_id: op.companyId,
          kind: "trusted_oss_bulk_approve",
          severity: "info",
          ref_table: "msgf_incidents",
          ref_id: id,
          summary: `Bulk OSS approve ${id}`,
          metadata: {
            eligibility,
            arbitrate_audit_id: result.arbitrate_audit_id ?? null,
            bulk_triage: true,
          },
        });
      } catch (e) {
        failed.push({
          id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return adminJson(req, {
      ok: true,
      approved,
      skipped,
      failed,
      allowlist,
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    return adminJson(
      req,
      { ok: false, error: e instanceof Error ? e.message : "bulk-resolve failed" },
      { status: 500 }
    );
  }
}
