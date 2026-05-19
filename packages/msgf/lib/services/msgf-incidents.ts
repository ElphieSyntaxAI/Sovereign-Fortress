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
/**

 * ARBITRATE layer — msgf_incidents queue (HITL tie-breaker + LOM recursion).

 */



import type { SupabaseClient } from "@supabase/supabase-js";



import {

  GenealogicalBugIndexSchema,

  PULSE_BUG_INDEX,

  type GenealogicalBugIndex,

} from "@/lib/schemas/vault-hall-metadata";

import type { HitlIncidentStrategies } from "@/lib/schemas/hitl-strategies";

import {

  generateHitlStrategies,

  isHitlTiebreakerBugIndex,

  type HitlStrategyGenerationContext,

} from "@/lib/services/hitl-strategy-generator";

import { enrichIncidentScopeWithCompany, listUserIdsForCompany } from "@/lib/msgf-operator-access";
import { withMsgfMetadataScope } from "@/lib/services/msgf-metadata-scope";
import { applyMsgfIncidentsTenantFilter } from "@/lib/services/tenant-query-scope";
import { isCostRunawayError } from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";

/**
 * `msgf_incidents` has no `metadata` JSONB column (see `20260528120000_msgf_incidents.sql`).
 * Set to true after a migration adds `metadata` if tenant/entity silo on rows is required.
 */
export const MSGF_INCIDENTS_SUPPORTS_METADATA = true;

export type MsgfIncidentScope = {
  tenantId: string;
  entityId?: string;
  companyId?: string | null;
};

function buildIncidentInsertRow(
  base: Record<string, unknown>,
  scope?: MsgfIncidentScope
): Record<string, unknown> {
  if (!MSGF_INCIDENTS_SUPPORTS_METADATA || !scope?.tenantId?.trim()) {
    return base;
  }
  return {
    ...base,
    metadata: withMsgfMetadataScope({}, {
      tenantId: scope.tenantId,
      entityId: scope.entityId ?? scope.tenantId,
      companyId: scope.companyId,
    }),
  };
}

export type MsgfIncidentStatus = "pending" | "resolved";



export const MSGF_INCIDENT_SOURCE_USER_SENTINEL = "USER_SENTINEL" as const;
export const MSGF_INCIDENT_SOURCE_SYSTEM = "SYSTEM" as const;
export const MSGF_INCIDENT_SOURCE_ARBITRATE_AUTO = "ARBITRATE_AUTO" as const;

export type MsgfIncidentSource =
  | typeof MSGF_INCIDENT_SOURCE_USER_SENTINEL
  | typeof MSGF_INCIDENT_SOURCE_SYSTEM
  | typeof MSGF_INCIDENT_SOURCE_ARBITRATE_AUTO;

export type MsgfIncidentRow = {

  id: string;

  user_id: string;

  narrative_log_id: string | null;

  status: MsgfIncidentStatus;

  bug_index: GenealogicalBugIndex;

  resolution_note: string | null;

  strategies: HitlIncidentStrategies | null;

  source?: MsgfIncidentSource;

  metadata?: Record<string, unknown> | null;

  created_at: string;

  updated_at: string;

};



const ARBITRATE_INSTANCES = new Set<string>([

  PULSE_BUG_INDEX.hallHitlRequired.level_1_1_1_instance,

  PULSE_BUG_INDEX.hallLomRecursion.level_1_1_1_instance,

]);



export function isArbitrateIncidentBugIndex(bugIndex: GenealogicalBugIndex): boolean {

  return ARBITRATE_INSTANCES.has(bugIndex.level_1_1_1_instance);

}



export async function insertMsgfArbitrateIncident(params: {

  adminSupabase: SupabaseClient;

  userId: string;

  narrativeLogId?: string;

  bugIndex: GenealogicalBugIndex;

  strategies?: HitlIncidentStrategies | null;

  hitlStrategyContext?: HitlStrategyGenerationContext;

  scope?: MsgfIncidentScope;

}): Promise<string | undefined> {

  if (!isArbitrateIncidentBugIndex(params.bugIndex)) {

    return undefined;

  }



  const bugIndex = GenealogicalBugIndexSchema.parse(params.bugIndex);



  const scope = await enrichIncidentScopeWithCompany(
    params.adminSupabase,
    params.userId,
    params.scope
  );



  let strategies = params.strategies ?? null;

  if (!strategies && isHitlTiebreakerBugIndex(bugIndex) && params.hitlStrategyContext) {

    try {
      strategies = await generateHitlStrategies(params.hitlStrategyContext);
    } catch (e) {
      if (isCostRunawayError(e)) {
        await recordCostRunawayDeadLetterSafe({
          adminSupabase: params.adminSupabase,
          tenantId: scope?.tenantId ?? params.scope?.tenantId ?? "",
          entityId: params.userId,
          operation: "msgf_incidents.generate_hitl_strategies",
          error: e,
        });
        strategies = null;
      } else {
        throw e;
      }
    }

  }



  const { data, error } = await params.adminSupabase

    .from("msgf_incidents")

    .insert(
      buildIncidentInsertRow(
        {
          user_id: params.userId,
          narrative_log_id: params.narrativeLogId ?? null,
          status: "pending",
          bug_index: bugIndex,
          strategies,
          source: MSGF_INCIDENT_SOURCE_ARBITRATE_AUTO,
        },
        scope
      )
    )

    .select("id")

    .maybeSingle();



  if (error) {

    console.error("[msgf-incidents] insert failed:", error.message);

    return undefined;

  }



  return data?.id as string | undefined;

}

/**
 * Every Sentinel / Report Issue report — always queued for M4 dashboard review.
 */
export async function insertMsgfUserSentinelIncident(params: {
  adminSupabase: SupabaseClient;
  userId: string;
  narrativeLogId?: string;
  bugIndex: GenealogicalBugIndex;
  strategies?: HitlIncidentStrategies | null;
  scope?: MsgfIncidentScope;
}): Promise<string | null> {
  const bugIndex = GenealogicalBugIndexSchema.parse(params.bugIndex);

  const scope = await enrichIncidentScopeWithCompany(
    params.adminSupabase,
    params.userId,
    params.scope
  );

  const { data, error } = await params.adminSupabase
    .from("msgf_incidents")
    .insert(
      buildIncidentInsertRow(
        {
          user_id: params.userId,
          narrative_log_id: params.narrativeLogId ?? null,
          status: "pending",
          bug_index: bugIndex,
          strategies: params.strategies ?? null,
          source: MSGF_INCIDENT_SOURCE_USER_SENTINEL,
        },
        scope
      )
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[msgf-incidents] USER_SENTINEL insert failed:", error.message);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}



export async function getMsgfIncidentById(params: {
  adminSupabase: SupabaseClient;
  id: string;
}): Promise<MsgfIncidentRow | null> {
  const { data, error } = await params.adminSupabase
    .from("msgf_incidents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    throw new Error(`msgf_incidents read: ${error.message}`);
  }

  return data ? (data as MsgfIncidentRow) : null;
}

export async function listMsgfIncidents(params: {

  adminSupabase: SupabaseClient;

  tenantId?: string;

  /** Company silo: incidents whose metadata or reporter profile matches. */
  companyId?: string;

  status?: MsgfIncidentStatus;

  limit?: number;

  offset?: number;

}): Promise<{ incidents: MsgfIncidentRow[]; count: number }> {

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

  const offset = Math.max(params.offset ?? 0, 0);



  let query = params.adminSupabase

    .from("msgf_incidents")

    .select("*", { count: "exact" })

    .order("created_at", { ascending: false })

    .range(offset, offset + limit - 1);



  if (params.status) {

    query = query.eq("status", params.status);

  }

  if (params.tenantId?.trim()) {

    query = applyMsgfIncidentsTenantFilter(query, params.tenantId);

  }

  const companyId = params.companyId?.trim();
  if (companyId) {
    const userIds = await listUserIdsForCompany(params.adminSupabase, companyId);
    if (userIds.length > 0) {
      query = query.or(
        `metadata->>company_id.eq.${companyId},user_id.in.(${userIds.join(",")})`
      );
    } else {
      query = query.eq("metadata->>company_id", companyId);
    }
  }



  const { data, error, count } = await query;



  if (error) {

    throw new Error(`msgf_incidents list: ${error.message}`);

  }



  return {

    incidents: (data ?? []) as MsgfIncidentRow[],

    count: count ?? 0,

  };

}



export async function updateMsgfIncident(params: {

  adminSupabase: SupabaseClient;

  id: string;

  status: MsgfIncidentStatus;

  resolutionNote?: string | null;

}): Promise<MsgfIncidentRow> {

  const { data, error } = await params.adminSupabase

    .from("msgf_incidents")

    .update({

      status: params.status,

      resolution_note: params.resolutionNote ?? null,

    })

    .eq("id", params.id)

    .select("*")

    .maybeSingle();



  if (error) {

    throw new Error(`msgf_incidents update: ${error.message}`);

  }

  if (!data) {

    throw new Error("msgf_incidents update: incident not found.");

  }



  return data as MsgfIncidentRow;

}


