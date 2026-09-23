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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardHashRedirect } from "@/app/_components/dashboard/DashboardHashRedirect";
import { DashboardShell } from "@/app/_components/dashboard/DashboardShell";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { resolveHealthOptionsForDashboardRequest } from "@/lib/dashboard-health-scope";
import { resolveHealQueueTenantIdForUser } from "@/lib/heal-queue-tenant";
import { ensureGatedAiBuyerAccount } from "@/lib/msgf-onboarding";
import { healthService } from "@/lib/services/HealthService";
import { listUserProjects } from "@/lib/services/user-projects";
import { loadWorkspaceContext } from "@/lib/workspace-context";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/**
 * Authenticated SaaS platform shell — six-pillar glass-box governance matrix.
 * Unauthenticated visitors are redirected to `/sign-in`.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; project_origin?: string }>;
}) {
  const params = await searchParams;
  const dashboardView = params.view === "roi" ? "roi" : "overview";
  const projectOrigin = params.project_origin?.trim() ?? "";
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/sign-in?next=/dashboard");
  }

  const admin = createAdminClient();

  const workspaceCtx = await loadWorkspaceContext(admin, user);
  if (!workspaceCtx.permissions.canAccessGovernanceDashboard) {
    redirect("/workspace");
  }

  try {
    await ensureGatedAiBuyerAccount({
      supabase: admin,
      entityId: user.id,
      username: user.email?.split("@")[0]?.trim() || "buyer",
    });
  } catch (e) {
    console.warn("[dashboard] buyer account setup:", e);
  }

  const projects = await listUserProjects(admin, user.id).catch(() => []);
  const showGovernanceMatrix = projects.length > 0;

  const access = await resolveDashboardAccessForUser(user);

  const { data: buyerProfile } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const healQueueTenantId =
    (typeof buyerProfile?.tenant_id === "string" && buyerProfile.tenant_id.trim()) ||
    resolveHealQueueTenantIdForUser(user);

  const healthOptions = await resolveHealthOptionsForDashboardRequest(admin, user, {
    lookbackHours: 168,
    scope: "personal",
  });
  if (projectOrigin) {
    healthOptions.projectOrigins = [projectOrigin];
  }
  const initialReport = await healthService.getPillarHealth(admin, healthOptions);

  const mappedCount = initialReport.scope.project_origins?.length ?? 0;
  const scopeDescription =
    mappedCount > 0
      ? `your account and ${mappedCount} mapped project${mappedCount === 1 ? "" : "s"}`
      : "your account (map projects in Workspace to scope by repository)";

  const mappedProjects = projects.map((p) => ({
    project_origin: p.project_origin,
    label: p.display_name?.trim() || p.project_origin,
  }));

  return (
    <>
      <DashboardHashRedirect />
      <DashboardShell
      userEmail={user.email ?? "Signed in"}
      initialReport={initialReport}
      healQueueTenantId={healQueueTenantId}
      mappedProjects={mappedProjects}
      healthScope="personal"
      canAccessAdminDashboard={access.canAccessAdminDashboard}
      scopeDescription={scopeDescription}
      dashboardLabel="Your governance dashboard"
      showGovernanceMatrix={showGovernanceMatrix}
      bugReportUserId={user.id}
      dashboardView={dashboardView}
      projectOrigin={projectOrigin}
    />
    </>
  );
}
