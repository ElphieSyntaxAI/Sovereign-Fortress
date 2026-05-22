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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
/**
 * Layered workspace controller — resolves Layer A + B for API + UI.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeAiAllowanceLevel,
  resolveWorkspaceConfig,
  type ResolvedWorkspaceConfig,
} from "@elphie-syntax/core";

import { educationTenantId } from "@/lib/education/lti/lti-config";
import {
  getAssignmentAllowanceLevel,
  getStudentGradeCohort,
  setAssignmentAllowanceLevel,
} from "@/lib/education/workspace/workspace-assignment-store";
import { createAdminClient } from "@/utils/supabase/admin";

export type WorkspaceConfigResponse = ResolvedWorkspaceConfig & {
  assignmentId: string;
  tenantId: string;
  entityId?: string;
  allowanceStreamPath: string;
};

export async function resolveEducationWorkspaceConfig(input: {
  assignmentId: string;
  entityId?: string;
  gradeCohort?: string;
  aiAllowanceLevel?: unknown;
  admin?: SupabaseClient;
}): Promise<WorkspaceConfigResponse> {
  const admin = input.admin ?? createAdminClient();
  const tenantId = educationTenantId();

  const gradeCohort =
    input.gradeCohort ??
    (input.entityId
      ? await getStudentGradeCohort(admin, input.entityId, tenantId)
      : "7_9");

  const aiLevel =
    input.aiAllowanceLevel !== undefined
      ? input.aiAllowanceLevel
      : await getAssignmentAllowanceLevel(admin, input.assignmentId);

  const workspace = resolveWorkspaceConfig({
    gradeCohort,
    aiAllowanceLevel: aiLevel,
  });

  return {
    ...workspace,
    assignmentId: input.assignmentId,
    tenantId,
    entityId: input.entityId,
    allowanceStreamPath: `/api/education/workspace/allowance/stream?assignmentId=${encodeURIComponent(input.assignmentId)}`,
  };
}

export async function updateAssignmentAllowance(input: {
  assignmentId: string;
  aiAllowanceLevel: unknown;
  updatedBy?: string;
  admin?: SupabaseClient;
}) {
  const admin = input.admin ?? createAdminClient();
  const level = await setAssignmentAllowanceLevel({
    admin,
    assignmentId: input.assignmentId,
    aiAllowanceLevel: normalizeAiAllowanceLevel(input.aiAllowanceLevel),
    updatedBy: input.updatedBy,
  });
  return resolveEducationWorkspaceConfig({
    assignmentId: input.assignmentId,
    aiAllowanceLevel: level,
    admin,
  });
}

export const educationWorkspaceController = {
  resolve: resolveEducationWorkspaceConfig,
  updateAllowance: updateAssignmentAllowance,
} as const;
