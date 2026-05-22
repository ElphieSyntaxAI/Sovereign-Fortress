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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Brain initialization readiness — six governance pillars + biometric baseline training.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { getBiometricProfile } from "@/lib/msgf-consensus";
import {
  MSGF_GOVERNANCE_PILLARS,
  PILLAR_BASELINE_REQUIRED_COUNT,
  ensureTenantPillarBaseline,
  fetchTenantBaselinePillarRows,
  listGovernancePillarsFromMetadata,
  type MsgfGovernancePillar,
} from "@/lib/services/pillar-baseline";

export type BrainReadinessResult = {
  /** 0–100; 100 only when all six pillars exist and baseline training is complete. */
  readiness_score: number;
  is_pillar_baseline_set: boolean;
  pillars_present: number;
  pillars_required: number;
  missing_pillars: MsgfGovernancePillar[];
  baseline_training_required: boolean;
  baseline_training_remaining: number;
  pledge_signed: boolean;
  brain_fully_initialized: boolean;
};

async function hasSignedPledge(
  supabase: SupabaseClient,
  entityId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("state_beats")
    .select("id")
    .eq("author_id", entityId)
    .eq("legal_version", CURRENT_LEGAL_VERSION)
    .eq("label", "pledge")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[brain-readiness] pledge query failed:", error.message);
    return false;
  }

  return Boolean(data?.id);
}

/**
 * Computes tenant Brain readiness without mutating pillar rows.
 */
export async function computeBrainReadiness(
  supabase: SupabaseClient,
  tenantId: string,
  entityId?: string
): Promise<BrainReadinessResult> {
  const actorId = entityId?.trim() || tenantId;
  const rows = await fetchTenantBaselinePillarRows(supabase, tenantId);
  const present = listGovernancePillarsFromMetadata(rows);
  const missing_pillars = MSGF_GOVERNANCE_PILLARS.filter((p) => !present.has(p));
  const pillars_present = present.size;
  const is_pillar_baseline_set = pillars_present >= PILLAR_BASELINE_REQUIRED_COUNT;

  const profile = await getBiometricProfile(supabase, actorId).catch(() => null);
  const baseline_training_remaining = profile?.baseline_training_remaining ?? 3;
  const baseline_training_required =
    !profile || baseline_training_remaining > 0;

  const pledge_signed = await hasSignedPledge(supabase, actorId);

  let readiness_score: number;

  if (!is_pillar_baseline_set) {
    readiness_score = Math.round((pillars_present / PILLAR_BASELINE_REQUIRED_COUNT) * 85);
  } else if (baseline_training_required) {
    const trainingPenalty = Math.min(15, baseline_training_remaining * 5);
    readiness_score = Math.max(85, 100 - trainingPenalty);
    if (!pledge_signed) {
      readiness_score = Math.min(readiness_score, 88);
    }
  } else if (!pledge_signed) {
    readiness_score = 95;
  } else {
    readiness_score = 100;
  }

  readiness_score = Math.max(0, Math.min(100, readiness_score));

  const brain_fully_initialized = readiness_score >= 100;

  return {
    readiness_score,
    is_pillar_baseline_set,
    pillars_present,
    pillars_required: PILLAR_BASELINE_REQUIRED_COUNT,
    missing_pillars,
    baseline_training_required,
    baseline_training_remaining,
    pledge_signed,
    brain_fully_initialized,
  };
}

/**
 * Ensures P1–P6 baseline rows exist, then returns updated readiness.
 */
export async function bootstrapTenantBrain(
  supabase: SupabaseClient,
  tenantId: string,
  entityId?: string
): Promise<BrainReadinessResult & { pillars_created: MsgfGovernancePillar[] }> {
  const seeded = await ensureTenantPillarBaseline(supabase, tenantId);
  const readiness = await computeBrainReadiness(supabase, tenantId, entityId);
  return {
    ...readiness,
    pillars_created: seeded.created,
  };
}

/** @deprecated Use {@link bootstrapTenantBrain} with `tenantId`. */
export async function bootstrapAuthorBrain(
  supabase: SupabaseClient,
  authorId: string
): Promise<BrainReadinessResult & { pillars_created: MsgfGovernancePillar[] }> {
  return bootstrapTenantBrain(supabase, authorId, authorId);
}
