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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DailyReportsAccordion } from "@/app/_components/dashboard/DailyReportsAccordion";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export default async function DailyReportsPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/sign-in?next=/dashboard/daily-reports");
  }

  const access = await resolveDashboardAccessForUser(user);

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <DashboardNav
        userEmail={user.email ?? "Signed in"}
        showAdminPortalLink={access.canAccessAdminDashboard}
        tokenSavingsHref="/dashboard#token-savings"
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-5 sm:py-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Governance archive
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gradient-jewel">Daily Reports</span>
          </h1>
          <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
            Per-repository archives of pillar health, token savings, and incidents — isolated by
            mapped project so separate workspaces (for example DealStar) never blend into one
            timeline. Expand any day for the six-pillar grid.
          </p>
        </header>

        <DailyReportsAccordion />
      </main>
    </div>
  );
}
