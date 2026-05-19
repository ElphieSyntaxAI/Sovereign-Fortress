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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  type DashboardOperatorContext,
  MsgfOperatorGateError,
} from "@/lib/msgf-operator-access";
import { appendRemediationStrategyLabel } from "@/lib/services/admin-incident-resolution";
import {
  MitigationActionSchema,
  isGlobalFixMitigation,
  type MitigationAction,
} from "@/lib/schemas/mitigation-action";
import {
  GenealogicalBugIndexSchema,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import { GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING } from "@/lib/services/global-approval-gate";
import { applyGlobalMitigation } from "@/lib/services/MitigationService";
import {
  getMsgfIncidentById,
  updateMsgfIncident,
  type MsgfIncidentRow,
  type MsgfIncidentStatus,
} from "@/lib/services/msgf-incidents";
import { pulseEngine } from "@/lib/services/PulseEngine";

export const patchIncidentBodySchema = z.object({
  status: z.enum(["pending", "resolved"]),
  resolution_note: z.string().max(8000).nullable().optional(),
  remediation_strategy_label: z.string().max(512).optional(),
  human_reasoning: z.string().max(8000).optional(),
  final_fix_applied: z.string().max(8000).optional(),
  mitigation_action: MitigationActionSchema.optional(),
});

export type PatchIncidentBody = z.infer<typeof patchIncidentBodySchema>;

export type ResolveAdminIncidentResult = {
  incident: MsgfIncidentRow;
  arbitration_beat_log_id?: string;
  education_vault_log_id?: string;
  global_mitigation_id?: string;
  global_rules_updated?: boolean;
  global_promotion_status?: string;
  local_cache_id?: string;
};

export async function resolveAdminIncident(params: {
  adminSupabase: SupabaseClient;
  incidentId: string;
  body: PatchIncidentBody;
  /** Ops / service-role caller — defaults true for admin incident routes. */
  isAdmin?: boolean;
  /** Dashboard operator RBAC — blocks Global Fix for company admins. */
  operator?: DashboardOperatorContext;
}): Promise<ResolveAdminIncidentResult> {
  const existing = await getMsgfIncidentById({
    adminSupabase: params.adminSupabase,
    id: params.incidentId,
  });

  if (!existing) {
    throw new Error("Incident not found.");
  }

  const resolutionNote = appendRemediationStrategyLabel(
    params.body.resolution_note ?? null,
    params.body.remediation_strategy_label
  );

  let arbitrationBeatLogId: string | undefined;
  let educationVaultLogId: string | undefined;
  let globalMitigationId: string | undefined;
  let globalRulesUpdated = false;

  const bugIndex = GenealogicalBugIndexSchema.parse(
    params.body.mitigation_action?.bug_index ?? existing.bug_index
  );

  const humanReasoning =
    params.body.human_reasoning?.trim() ??
    params.body.resolution_note?.trim() ??
    resolutionNote ??
    "";

  const finalFixApplied =
    params.body.final_fix_applied?.trim() ??
    params.body.mitigation_action?.fix_template?.trim() ??
    "";

  const globalFix = isGlobalFixMitigation(params.body.mitigation_action);
  if (params.operator?.role === "COMPANY_ADMIN" && globalFix) {
    throw new MsgfOperatorGateError(
      "Global Fix requires a global operator. Apply locally (session-scoped) or escalate.",
      403
    );
  }

  const incidentMeta =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const tenantId =
    typeof incidentMeta.tenant_id === "string" && incidentMeta.tenant_id.trim()
      ? incidentMeta.tenant_id.trim()
      : existing.user_id;

  let globalPromotionStatus: string | undefined;
  let localCacheId: string | undefined;

  if (params.body.status === "resolved") {
    const beatResult = await pulseEngine.writeArbitrationBeat({
      adminSupabase: params.adminSupabase,
      entityId: existing.user_id,
      tenantId,
      incidentId: existing.id,
      bugIndex,
      humanReasoning,
      finalFixApplied,
      remediationStrategyLabel: params.body.remediation_strategy_label,
      globalMitigation: globalFix,
      mitigationAction: params.body.mitigation_action,
      isAdmin: params.isAdmin !== false,
    });

    arbitrationBeatLogId = beatResult.narrativeLogId;
    globalPromotionStatus = beatResult.promotion_status;
    localCacheId = beatResult.local_cache_id;

    const educationResult = await pulseEngine.writeP2EducationVaultEntry({
      adminSupabase: params.adminSupabase,
      entityId: existing.user_id,
      tenantId,
      incidentId: existing.id,
      bugIndex,
      humanReasoning,
      finalFixApplied,
      remediationStrategyLabel: params.body.remediation_strategy_label,
      globalMitigation: globalFix,
      mitigationAction: params.body.mitigation_action,
      isAdmin: params.isAdmin !== false,
    });

    educationVaultLogId = educationResult.narrativeLogId;
    globalPromotionStatus =
      educationResult.promotion_status ?? globalPromotionStatus;
    localCacheId = educationResult.local_cache_id ?? localCacheId;

    if (globalFix && params.body.mitigation_action) {
      const mitigation = buildMitigationForRules(
        params.body.mitigation_action,
        bugIndex,
        params.body.remediation_strategy_label
      );

      const applied = await applyGlobalMitigation({
        adminSupabase: params.adminSupabase,
        tenantId,
        entityId: existing.user_id,
        bugIndex,
        mitigation,
        humanReasoning,
        finalFixApplied,
        incidentId: existing.id,
        remediationStrategyLabel: params.body.remediation_strategy_label,
        isAdmin: params.isAdmin !== false,
      });

      globalMitigationId = applied.mitigationId;
      globalRulesUpdated = applied.ruleUpdated;
      globalPromotionStatus = applied.promotion_status ?? globalPromotionStatus;
      localCacheId = applied.local_cache_id ?? localCacheId;
    }
  }

  const incident = await updateMsgfIncident({
    adminSupabase: params.adminSupabase,
    id: params.incidentId,
    status: params.body.status as MsgfIncidentStatus,
    resolutionNote,
  });

  return {
    incident,
    arbitration_beat_log_id: arbitrationBeatLogId,
    education_vault_log_id: educationVaultLogId,
    global_mitigation_id: globalMitigationId,
    global_rules_updated: globalRulesUpdated,
    global_promotion_status:
      globalPromotionStatus ??
      (globalFix ? GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING : undefined),
    local_cache_id: localCacheId,
  };
}

function buildMitigationForRules(
  action: MitigationAction,
  bugIndex: GenealogicalBugIndex,
  strategyLabel?: string
): MitigationAction {
  return {
    ...action,
    kind: "Global Fix",
    bug_index: bugIndex,
    label: action.label ?? strategyLabel,
    apply_to_future_sessions: true,
  };
}
