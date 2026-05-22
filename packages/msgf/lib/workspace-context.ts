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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { fetchProfileCompanyAndRole } from "@/lib/msgf-operator-access";
import { isIndependentDeveloper } from "@/lib/msgf-tenant-governance";
import { listUserProjects, type UserProjectRow } from "@/lib/services/user-projects";

export type WorkspaceContext = {
  userId: string;
  email: string;
  companyId: string | null;
  accessRole: string;
  isIndependent: boolean;
  isNewWorkspace: boolean;
  projectCount: number;
  projects: UserProjectRow[];
  canAccessAdminDashboard: boolean;
};

export async function loadWorkspaceContext(
  admin: SupabaseClient,
  user: User
): Promise<WorkspaceContext> {
  const [profile, projects, access] = await Promise.all([
    fetchProfileCompanyAndRole(admin, user.id).catch(() => ({
      msgf_access_role: "DEVELOPER" as const,
      company_id: null as string | null,
    })),
    listUserProjects(admin, user.id).catch(() => [] as UserProjectRow[]),
    resolveDashboardAccessForUser(user),
  ]);

  const isIndependent = isIndependentDeveloper({
    company_id: profile.company_id,
    tenantKey: null,
  });

  const isNewWorkspace = projects.length === 0 && isIndependent;

  return {
    userId: user.id,
    email: user.email ?? "Signed in",
    companyId: profile.company_id,
    accessRole: profile.msgf_access_role,
    isIndependent,
    isNewWorkspace,
    projectCount: projects.length,
    projects,
    canAccessAdminDashboard: access.canAccessAdminDashboard,
  };
}
