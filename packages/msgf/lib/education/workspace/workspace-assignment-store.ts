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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * Persist Layer B `ai_allowance_level` per assignment (Postgres cold config).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeAiAllowanceLevel,
  type AiAllowanceLevel,
} from "@elphie-syntax/core";

import { educationTenantId } from "@/lib/education/lti/lti-config";
import {
  publishLayerBAllowanceUpdate,
  readCachedAssignmentAllowance,
} from "@/lib/education/workspace/allowance-broadcast";

export async function getAssignmentAllowanceLevel(
  admin: SupabaseClient,
  assignmentId: string,
  fallback: AiAllowanceLevel = 3
): Promise<AiAllowanceLevel> {
  const cached = await readCachedAssignmentAllowance(assignmentId);
  if (cached) return cached.aiAllowanceLevel;

  const { data, error } = await admin
    .from("education_assignment_workspace")
    .select("ai_allowance_level")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (error) {
    console.warn("[workspace-assignment-store] read failed:", error.message);
    return fallback;
  }

  if (data?.ai_allowance_level != null) {
    return normalizeAiAllowanceLevel(data.ai_allowance_level, fallback);
  }

  return fallback;
}

export async function setAssignmentAllowanceLevel(params: {
  admin: SupabaseClient;
  assignmentId: string;
  aiAllowanceLevel: AiAllowanceLevel;
  updatedBy?: string;
  tenantId?: string;
}): Promise<AiAllowanceLevel> {
  const tenantId = params.tenantId ?? educationTenantId();
  const level = normalizeAiAllowanceLevel(params.aiAllowanceLevel);

  const { error } = await params.admin.from("education_assignment_workspace").upsert(
    {
      assignment_id: params.assignmentId,
      tenant_id: tenantId,
      ai_allowance_level: level,
      updated_at: new Date().toISOString(),
      updated_by: params.updatedBy ?? null,
    },
    { onConflict: "assignment_id" }
  );

  if (error) {
    throw new Error(`education_assignment_workspace upsert: ${error.message}`);
  }

  await publishLayerBAllowanceUpdate(params.assignmentId, level);
  return level;
}

export async function getStudentGradeCohort(
  admin: SupabaseClient,
  entityId: string,
  tenantId?: string
): Promise<string> {
  const tid = tenantId ?? educationTenantId();
  const { data, error } = await admin
    .from("education_privacy_vault")
    .select("grade_cohort")
    .eq("tenant_id", tid)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error || !data?.grade_cohort) {
    return "7_9";
  }
  return String(data.grade_cohort);
}
