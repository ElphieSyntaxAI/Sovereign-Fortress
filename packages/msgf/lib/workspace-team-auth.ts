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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Authenticated workspace session + platform RBAC for team/onboarding API routes.
 */

import { cookies, headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveSessionPermissions,
  type SessionPermissions,
} from "@/lib/platform-rbac";
import { isIndependentDeveloper } from "@/lib/msgf-tenant-governance";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export type WorkspaceTeamSession = {
  user: User;
  admin: SupabaseClient;
  permissions: SessionPermissions;
  companyId: string | null;
  teamPlatformRole: string | null;
  accountStatus: string;
};

export async function requireWorkspaceTeamSession(): Promise<WorkspaceTeamSession | null> {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const requestHost = requestHostFromHeaders(hdrs);
  const supabase = createClient(cookieStore, requestHost);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("p4_profiles")
    .select("company_id, team_platform_role, account_status, msgf_access_role")
    .eq("user_id", user.id)
    .maybeSingle();

  const companyId =
    typeof profile?.company_id === "string" ? profile.company_id.trim() || null : null;
  const isIndependent = isIndependentDeveloper({ company_id: companyId, tenantKey: null });

  const permissions = resolveSessionPermissions({
    isIndependentSandbox: isIndependent,
    teamPlatformRole: profile?.team_platform_role as string | undefined,
    accountStatus: profile?.account_status as string | undefined,
    msgfAccessRole: profile?.msgf_access_role as string | undefined,
  });

  return {
    user,
    admin,
    permissions,
    companyId,
    teamPlatformRole: (profile?.team_platform_role as string | null) ?? null,
    accountStatus: (profile?.account_status as string) ?? "active",
  };
}

export function assertCanManageTeam(session: WorkspaceTeamSession): void {
  if (!session.permissions.canManageTeam) {
    throw new Error("Only admins can manage team access.");
  }
}
