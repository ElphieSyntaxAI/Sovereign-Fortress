/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
/**
 * State-ledger telemetry → pending ARBITRATE incidents (P4 pillar queue).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import { bugIndexToGovernancePillar } from "@/lib/services/HealthService";
import { resolveHealIncidentProjectOrigin } from "@/lib/services/heal-incident-scope";
import { insertMsgfUserSentinelIncident } from "@/lib/services/msgf-incidents";
import { msgfRedisKey, redisIncrWithWindow } from "@/lib/redis";

const LEDGER_INCIDENT_DEDUP_SEC =
  Number(process.env.MSGF_STATE_LEDGER_INCIDENT_DEDUP_SEC?.trim()) || 3600;

export async function enqueueStateLedgerBreakdownIncidents(params: {
  admin: SupabaseClient;
  entityId: string;
  tenantId: string;
  projectOrigin?: string | null;
  tenantKey?: string | null;
  breakdowns: GenealogicalBugIndex[];
}): Promise<string[]> {
  const projectOrigin =
    params.projectOrigin?.trim() ||
    resolveHealIncidentProjectOrigin({ tenantKey: params.tenantKey }) ||
    undefined;

  const ids: string[] = [];

  for (const bugIndex of params.breakdowns) {
    const pillar = bugIndexToGovernancePillar(bugIndex);
    if (pillar !== "P4") continue;

    const dedupKey = msgfRedisKey(
      "state_ledger",
      "incident",
      params.tenantId,
      params.entityId,
      bugIndex.level_1_1_1_instance
    );
    const count = (await redisIncrWithWindow(dedupKey, LEDGER_INCIDENT_DEDUP_SEC)) ?? 1;
    if (count > 1) continue;

    const id = await insertMsgfUserSentinelIncident({
      adminSupabase: params.admin,
      userId: params.entityId,
      scope: {
        tenantId: params.tenantId,
        entityId: params.entityId,
        projectOrigin,
      },
      bugIndex,
      strategies: null,
    });
    if (id) ids.push(id);
  }

  return ids;
}
