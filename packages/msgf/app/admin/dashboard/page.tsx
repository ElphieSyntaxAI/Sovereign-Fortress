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
 * Distribution Build ID: MSGF-5e9b050-20260519T172718Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/app/_components/dashboard/DashboardShell";
import {
  assertSessionOperatorIsAdmin,
  healthOptionsForSessionOperator,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { healthService } from "@/lib/services/HealthService";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/**
 * Supabase-session admin dashboard.
 *
 * `/sign-in` remains the normal tenant/user dashboard. `/admin/sign-in` uses
 * the same AuthForm but lands here, where we require an MSGF operator role.
 */
export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/admin/sign-in?next=/admin/dashboard");
  }

  const admin = createAdminClient();
  const op = await resolveSessionDashboardOperator(admin, user);

  try {
    assertSessionOperatorIsAdmin(op);
  } catch {
    redirect("/unauthorized");
  }

  const initialReport = await healthService.getPillarHealth(
    admin,
    await healthOptionsForSessionOperator(admin, op, 168)
  );

  return (
    <DashboardShell
      userEmail={user.email ?? "Signed in"}
      initialReport={initialReport}
      authRedirectPath="/admin/sign-in?next=/admin/dashboard"
      dashboardLabel={op.role === "GLOBAL_ADMIN" ? "Global admin dashboard" : "Company admin dashboard"}
    />
  );
}
