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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import {
  REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
  REMEDIATION_STATE,
  type RemediationStateValue,
} from "@/lib/schemas/remediation-state";

export type RemediationState = RemediationStateValue;
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { applyPillarVectorsTenantFilter } from "@/lib/services/tenant-query-scope";
import { extractProjectOriginFromPulseBody } from "@/lib/utils/pulse-eco-context";

export { REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS, REMEDIATION_STATE };

export type RemediationAttemptKey = {
  file_path: string;
  bug_index_instance: string;
};

export function remediationAttemptKey(
  filePath: string,
  bugIndex: GenealogicalBugIndex | { level_1_1_1_instance: string }
): RemediationAttemptKey {
  const instance = bugIndex.level_1_1_1_instance;
  return {
    file_path: filePath.replace(/\\/g, "/").replace(/^\.\/+/, ""),
    bug_index_instance: instance.trim(),
  };
}

export function isCircuitBreakerTripped(state: string | null | undefined): boolean {
  return state === REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION;
}

export type RemediationCircuitTripResult = {
  tripped: boolean;
  remediation_state: RemediationState;
  consecutive_failures: number;
  pillar_vector_id: string | null;
  message: string;
};

function parseBugIndexFromMeta(meta: Record<string, unknown>): GenealogicalBugIndex | null {
  const parsed = GenealogicalBugIndexSchema.safeParse(meta.bug_index);
  if (parsed.success) return parsed.data;
  const instance = typeof meta.instance_slug === "string" ? meta.instance_slug : null;
  const category = typeof meta.category === "string" ? meta.category : null;
  const branch = typeof meta.branch === "string" ? meta.branch : null;
  if (instance && category && branch) {
    const coerced = GenealogicalBugIndexSchema.safeParse({
      level_1_category: category,
      level_1_1_branch: branch,
      level_1_1_1_instance: instance,
    });
    if (coerced.success) return coerced.data;
  }
  return null;
}

async function findPillarVectorRow(params: {
  admin: SupabaseClient;
  tenantId: string;
  filePath: string;
  bugIndexInstance: string;
  pillarVectorId?: string | null;
}): Promise<{
  id: string;
  metadata: Record<string, unknown>;
  remediation_state: string | null;
  remediation_attempt_count: number;
} | null> {
  if (params.pillarVectorId) {
    const { data } = await fromPillarVectors(params.admin, params.tenantId)
      .select("id, metadata, remediation_state, remediation_attempt_count")
      .eq("id", params.pillarVectorId)
      .maybeSingle();
    if (data?.id) {
      return {
        id: data.id as string,
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
        remediation_state: (data.remediation_state as string | null) ?? null,
        remediation_attempt_count: Number(data.remediation_attempt_count ?? 0),
      };
    }
  }

  type CircuitRow = {
    id: string;
    metadata: Record<string, unknown> | null;
    remediation_state: string | null;
    remediation_attempt_count: number | null;
  };
  type CircuitQuery = {
    limit: (n: number) => Promise<{
      data: CircuitRow[] | null;
      error: { message: string } | null;
    }>;
  };

  let circuitQuery = fromPillarVectors(params.admin, params.tenantId).select(
    "id, metadata, remediation_state, remediation_attempt_count"
  ) as unknown as CircuitQuery;
  circuitQuery = applyPillarVectorsTenantFilter(
    circuitQuery as unknown as Parameters<typeof applyPillarVectorsTenantFilter>[0],
    params.tenantId
  ) as unknown as CircuitQuery;

  const { data, error } = await circuitQuery.limit(20);
  if (error) {
    throw new Error(`remediation circuit lookup failed: ${error.message}`);
  }

  const normalizedPath = params.filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");

  for (const row of data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const path =
      typeof meta.original_path === "string"
        ? meta.original_path
        : typeof meta.file_path === "string"
          ? meta.file_path
          : null;
    const bug =
      parseBugIndexFromMeta(meta)?.level_1_1_1_instance ??
      (typeof meta.instance_slug === "string" ? meta.instance_slug : null);

    if (path === normalizedPath && bug === params.bugIndexInstance) {
      return {
        id: row.id as string,
        metadata: meta,
        remediation_state: (row.remediation_state as string | null) ?? null,
        remediation_attempt_count: Number(row.remediation_attempt_count ?? 0),
      };
    }
  }

  return null;
}

/**
 * Trip circuit: PENDING_HUMAN_ARBITRATION, clear scheduling flags, block cron.
 */
export async function tripRemediationCircuitBreaker(params: {
  admin: SupabaseClient;
  tenantId: string;
  filePath: string;
  bugIndex: GenealogicalBugIndex;
  reason: string;
  pillarVectorId?: string | null;
  source?: string;
}): Promise<RemediationCircuitTripResult> {
  const key = remediationAttemptKey(params.filePath, params.bugIndex);
  const row = await findPillarVectorRow({
    admin: params.admin,
    tenantId: params.tenantId,
    filePath: key.file_path,
    bugIndexInstance: key.bug_index_instance,
    pillarVectorId: params.pillarVectorId,
  });

  const trippedAt = new Date().toISOString();
  const metaPatch = {
    heal_queue_pending: false,
    preset_interval: null,
    scheduling_tier: null,
    remediation_circuit_tripped_at: trippedAt,
    remediation_circuit_reason: params.reason.slice(0, 2000),
    remediation_circuit_source: params.source ?? "consensus_remediation",
    remediation_failure_streak: REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
    bug_index: params.bugIndex,
    file_path: key.file_path,
    original_path: key.file_path,
    instance_slug: key.bug_index_instance,
  };

  if (row) {
    const prior = row.metadata;
    const { error } = await fromPillarVectors(params.admin, params.tenantId)
      .update({
        remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
        remediation_attempt_count: REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
        scheduling_tier: null,
        metadata: { ...prior, ...metaPatch },
      })
      .eq("id", row.id);

    if (error) {
      throw new Error(`circuit breaker update failed: ${error.message}`);
    }

    return {
      tripped: true,
      remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
      consecutive_failures: REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
      pillar_vector_id: row.id,
      message: `Circuit breaker: ${key.file_path} (${key.bug_index_instance}) → PENDING_HUMAN_ARBITRATION`,
    };
  }

  const { data: inserted, error: insertErr } = await fromPillarVectors(params.admin, params.tenantId)
    .insert({
      content: `Remediation circuit breaker: ${key.file_path}`,
      remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
      remediation_attempt_count: REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
      scheduling_tier: null,
      metadata: {
        tenant_id: params.tenantId,
        ledger: "hall",
        index_type: "genealogical_bug_index",
        ...metaPatch,
      },
    })
    .select("id")
    .single();

  if (insertErr) {
    throw new Error(`circuit breaker insert failed: ${insertErr.message}`);
  }

  return {
    tripped: true,
    remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
    consecutive_failures: REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS,
    pillar_vector_id: inserted?.id as string,
    message: `Circuit breaker (new row): ${key.file_path} → PENDING_HUMAN_ARBITRATION`,
  };
}

/**
 * Record a consecutive failure; trips breaker when count reaches max.
 */
export async function recordRemediationFailure(params: {
  admin: SupabaseClient;
  tenantId: string;
  filePath: string;
  bugIndex: GenealogicalBugIndex;
  reason: string;
  pillarVectorId?: string | null;
  source?: string;
}): Promise<RemediationCircuitTripResult> {
  const key = remediationAttemptKey(params.filePath, params.bugIndex);
  const row = await findPillarVectorRow({
    admin: params.admin,
    tenantId: params.tenantId,
    filePath: key.file_path,
    bugIndexInstance: key.bug_index_instance,
    pillarVectorId: params.pillarVectorId,
  });

  if (row && isCircuitBreakerTripped(row.remediation_state)) {
    return {
      tripped: true,
      remediation_state: REMEDIATION_STATE.PENDING_HUMAN_ARBITRATION,
      consecutive_failures: row.remediation_attempt_count,
      pillar_vector_id: row.id,
      message: `Circuit already open for ${key.file_path} (${key.bug_index_instance})`,
    };
  }

  const priorCount = row?.remediation_attempt_count ?? 0;

  const nextCount = priorCount + 1;
  const now = new Date().toISOString();

  if (nextCount >= REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS) {
    return tripRemediationCircuitBreaker({
      ...params,
      reason: `${params.reason} (${nextCount} consecutive failures, max=${REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS})`,
    });
  }

  const metaBase = {
    ...(row?.metadata ?? {}),
    remediation_failure_streak: nextCount,
    remediation_last_failure_at: now,
    remediation_last_failure_reason: params.reason.slice(0, 2000),
    remediation_last_failure_source: params.source ?? "heal_queue",
    bug_index: params.bugIndex,
    file_path: key.file_path,
    original_path: key.file_path,
    instance_slug: key.bug_index_instance,
  };

  if (row) {
    await fromPillarVectors(params.admin, params.tenantId)
      .update({
        remediation_state: REMEDIATION_STATE.ACTIVE,
        remediation_attempt_count: nextCount,
        metadata: metaBase,
      })
      .eq("id", row.id);
  }

  return {
    tripped: false,
    remediation_state: REMEDIATION_STATE.ACTIVE,
    consecutive_failures: nextCount,
    pillar_vector_id: row?.id ?? null,
    message: `Failure ${nextCount}/${REMEDIATION_MAX_CONSECUTIVE_ATTEMPTS} for ${key.file_path}`,
  };
}

/** Reset consecutive failure streak after successful remediation / consensus. */
export async function recordRemediationSuccess(params: {
  admin: SupabaseClient;
  tenantId: string;
  filePath: string;
  bugIndex: GenealogicalBugIndex;
  pillarVectorId?: string | null;
}): Promise<void> {
  const key = remediationAttemptKey(params.filePath, params.bugIndex);
  const row = await findPillarVectorRow({
    admin: params.admin,
    tenantId: params.tenantId,
    filePath: key.file_path,
    bugIndexInstance: key.bug_index_instance,
    pillarVectorId: params.pillarVectorId,
  });

  if (!row) return;

  const prior = row.metadata;
  await fromPillarVectors(params.admin, params.tenantId)
    .update({
      remediation_state: REMEDIATION_STATE.RESOLVED,
      remediation_attempt_count: 0,
      metadata: {
        ...prior,
        remediation_failure_streak: 0,
        remediation_last_success_at: new Date().toISOString(),
        heal_queue_pending: false,
      },
    })
    .eq("id", row.id);
}

/** Throws if scheduling is not allowed (circuit open). */
/** Stable remediation key for Pulse CONVERGE failures (project_origin or synthetic). */
export function resolveRemediationFilePath(params: {
  rawBody?: unknown;
  tenantId: string;
  entityId: string;
  pulseTraceId?: string;
}): string {
  const origin = params.rawBody
    ? extractProjectOriginFromPulseBody(params.rawBody)
    : undefined;
  if (origin) return origin;
  const trace = params.pulseTraceId?.trim();
  if (trace) return `pulse://${params.tenantId}/${trace}`;
  return `pulse://${params.tenantId}/${params.entityId}`;
}

export function assertRemediationSchedulable(state: string | null | undefined, filePath: string): void {
  if (isCircuitBreakerTripped(state)) {
    throw new Error(
      `Cannot schedule remediation for ${filePath}: circuit breaker open (PENDING_HUMAN_ARBITRATION). Human arbitration required.`
    );
  }
}
