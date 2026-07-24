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
 * Workspace page context — projects, RBAC permissions, compliance.
 */

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { shouldShowMonorepoWorkspacePresets } from "@/lib/monorepo-presets-access";
import { fetchProfileCompanyAndRole } from "@/lib/msgf-operator-access";
import { isIndependentDeveloper } from "@/lib/msgf-tenant-governance";
import {
  resolveSessionPermissions,
  type SessionPermissions,
} from "@/lib/platform-rbac";
import { listUserProjects, type UserProjectRow } from "@/lib/services/user-projects";

export type WorkspaceContext = {
  userId: string;
  email: string;
  companyId: string | null;
  accessRole: string;
  teamPlatformRole: string | null;
  accountStatus: string;
  permissions: SessionPermissions;
  isIndependent: boolean;
  isNewWorkspace: boolean;
  projectCount: number;
  projects: UserProjectRow[];
  canAccessAdminDashboard: boolean;
};

async function filterProjectsForUser(
  admin: SupabaseClient,
  userId: string,
  companyId: string | null,
  projects: UserProjectRow[],
  permissions: SessionPermissions
): Promise<UserProjectRow[]> {
  if (permissions.isIndependentSandbox || permissions.roles.includes("admin")) {
    return projects;
  }
  if (!companyId) return projects;

  const { data: assignments } = await admin
    .from("msgf_user_project_assignments")
    .select("project_origin")
    .eq("user_id", userId)
    .eq("company_id", companyId);

  const allowed = new Set((assignments ?? []).map((a) => a.project_origin as string));
  if (allowed.size === 0) return projects;
  return projects.filter((p) => allowed.has(p.project_origin));
}

export async function loadWorkspaceContext(
  admin: SupabaseClient,
  user: User
): Promise<WorkspaceContext> {
  const { data: profileRow } = await admin
    .from("p4_profiles")
    .select("msgf_access_role, company_id, team_platform_role, account_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = {
    msgf_access_role: profileRow?.msgf_access_role,
    company_id: profileRow?.company_id as string | null | undefined,
  };

  const [operatorProfile, allProjects, access] = await Promise.all([
    fetchProfileCompanyAndRole(admin, user.id).catch(() => ({
      msgf_access_role: "DEVELOPER" as const,
      company_id: null as string | null,
    })),
    listUserProjects(admin, user.id).catch(() => [] as UserProjectRow[]),
    resolveDashboardAccessForUser(user),
  ]);

  const companyId =
    typeof profileRow?.company_id === "string" ? profileRow.company_id.trim() || null : null;

  const isIndependent = isIndependentDeveloper({
    company_id: companyId ?? operatorProfile.company_id,
    tenantKey: null,
  });

  /** External customers mapping custom repos — not corp team members on the platform monorepo. */
  const isExternalProjectMapper =
    !shouldShowMonorepoWorkspacePresets(user.email) && allProjects.length > 0;

  const permissions = resolveSessionPermissions({
    isIndependentSandbox: isIndependent || isExternalProjectMapper,
    teamPlatformRole: profileRow?.team_platform_role as string | undefined,
    accountStatus: profileRow?.account_status as string | undefined,
    msgfAccessRole: operatorProfile.msgf_access_role,
  });

  const projects = await filterProjectsForUser(
    admin,
    user.id,
    companyId,
    allProjects,
    permissions
  );

  const isNewWorkspace = projects.length === 0 && isIndependent;

  return {
    userId: user.id,
    email: user.email ?? "Signed in",
    companyId: companyId ?? operatorProfile.company_id,
    accessRole: operatorProfile.msgf_access_role,
    teamPlatformRole: (profileRow?.team_platform_role as string | null) ?? null,
    accountStatus: (profileRow?.account_status as string) ?? "active",
    permissions,
    isIndependent,
    isNewWorkspace,
    projectCount: projects.length,
    projects,
    canAccessAdminDashboard: access.canAccessAdminDashboard,
  };
}
