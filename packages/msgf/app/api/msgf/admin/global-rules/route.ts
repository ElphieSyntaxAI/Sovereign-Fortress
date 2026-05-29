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
import { MitigationActionSchema } from "@/lib/schemas/mitigation-action";
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";
import { applyGlobalMitigation } from "@/lib/services/MitigationService";
import { getMsgfIncidentById } from "@/lib/services/msgf-incidents";
import { createAdminClient } from "@/utils/supabase/admin";

const postBodySchema = z.object({
  incident_id: z.string().uuid().optional(),
  entity_id: z.string().uuid().optional(),
  /** @deprecated Use `entity_id`. */
  author_id: z.string().uuid().optional(),
  document_id: z.string().max(128).optional(),
  mitigation_action: MitigationActionSchema,
  human_reasoning: z.string().max(8000).optional(),
  final_fix_applied: z.string().max(8000).optional(),
  remediation_strategy_label: z.string().max(512).optional(),
  bug_index: GenealogicalBugIndexSchema.optional(),
});

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

/**
 * POST /api/msgf/admin/global-rules
 *
 * Applies a **Global Fix** mitigation to `msgf_rules` (`global_mitigations` namespace).
 * Pair with PATCH `/incidents/:id` to write Vault education beats for Cross-Ref.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveDashboardOperator(req, admin);

    if (op.role !== "GLOBAL_ADMIN") {
      return adminJson(
        req,
        { ok: false, error: "Applying global mitigation rules requires a global operator." },
        { status: 403 }
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
        { ok: false, error: "mitigation_action.kind must be Global Fix for this endpoint." },
        { status: 400 }
      );
    }

    let bugIndex = parsed.data.bug_index;
    let incidentId = parsed.data.incident_id;
    let entityId = parsed.data.entity_id ?? parsed.data.author_id;

    if (incidentId) {
      const incident = await getMsgfIncidentById({ adminSupabase: admin, id: incidentId });
      if (!incident) {
        return adminJson(req, { ok: false, error: "Incident not found." }, { status: 404 });
      }
      bugIndex = GenealogicalBugIndexSchema.parse(
        parsed.data.bug_index ?? incident.bug_index
      );
      entityId = entityId ?? incident.user_id;
    }

    if (!bugIndex) {
      return adminJson(
        req,
        { ok: false, error: "bug_index or incident_id required." },
        { status: 400 }
      );
    }

    if (!entityId) {
      return adminJson(
        req,
        { ok: false, error: "entity_id required (or pass incident_id)." },
        { status: 400 }
      );
    }

    const humanReasoning =
      parsed.data.human_reasoning?.trim() ??
      parsed.data.mitigation_action.label ??
      "Operator global mitigation";
    const finalFixApplied =
      parsed.data.final_fix_applied?.trim() ??
      parsed.data.mitigation_action.fix_template?.trim() ??
      "";

    const applied = await applyGlobalMitigation({
      adminSupabase: admin,
      tenantId: entityId,
      entityId,
      documentId: parsed.data.document_id,
      bugIndex,
      mitigation: {
        ...parsed.data.mitigation_action,
        kind: "Global Fix",
        apply_to_future_sessions: true,
        bug_index: bugIndex,
      },
      humanReasoning,
      finalFixApplied,
      incidentId,
      remediationStrategyLabel: parsed.data.remediation_strategy_label,
      isAdmin: true,
    });

    return adminJson(req, {
      ok: true,
      global_mitigation_id: applied.mitigationId,
      global_rules_updated: applied.ruleUpdated,
      lineage_keys_invalidated: applied.lineage_keys_invalidated,
      global_promotion_status: applied.promotion_status,
      ...(applied.local_cache_id ? { local_cache_id: applied.local_cache_id } : {}),
    });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Failed to apply global rules.";
    console.error("[admin/global-rules] POST", e);
    return adminJson(req, { ok: false, error: msg }, { status: 500 });
  }
}
