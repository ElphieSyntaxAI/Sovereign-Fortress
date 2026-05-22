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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/app/_components/dashboard/DashboardShell";
import { ProductExplorerSection } from "@/app/_components/dashboard/ProductExplorerSection";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { resolveHealthOptionsForDashboardRequest } from "@/lib/dashboard-health-scope";
import { healthService } from "@/lib/services/HealthService";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/**
 * Authenticated SaaS platform shell — six-pillar glass-box governance matrix.
 * Unauthenticated visitors are redirected to `/sign-in`.
 */
export default async function DashboardPage() {
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
  const access = await resolveDashboardAccessForUser(user);
  const healthOptions = await resolveHealthOptionsForDashboardRequest(admin, user, {
    lookbackHours: 168,
    scope: "personal",
  });
  const initialReport = await healthService.getPillarHealth(admin, healthOptions);

  const mappedCount = initialReport.scope.project_origins?.length ?? 0;
  const scopeDescription =
    mappedCount > 0
      ? `your account and ${mappedCount} mapped project${mappedCount === 1 ? "" : "s"}`
      : "your account (map projects in Workspace to scope by repository)";

  return (
    <DashboardShell
      userEmail={user.email ?? "Signed in"}
      initialReport={initialReport}
      healthScope="personal"
      canAccessAdminDashboard={access.canAccessAdminDashboard}
      scopeDescription={scopeDescription}
      dashboardLabel="Your governance dashboard"
      productExplorer={<ProductExplorerSection />}
    />
  );
}
