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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DailyReportsAccordion } from "@/app/_components/dashboard/DailyReportsAccordion";
import { PeriodSavingsReportsPanel } from "@/app/_components/dashboard/PeriodSavingsReportsPanel";
import { ShadowProxySavingsPanel } from "@/app/_components/dashboard/ShadowProxySavingsPanel";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { createAdminClient } from "@/utils/supabase/admin";
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
  const admin = createAdminClient();
  const { data: buyerProfile } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const tenantId =
    (typeof buyerProfile?.tenant_id === "string" && buyerProfile.tenant_id.trim()) ||
    user.id;

  return (
    <div className="app-shell min-h-screen text-slate-100">
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
            <span className="text-gradient-jewel">Reports</span>
          </h1>
          <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
            Daily pillar archives per repository, plus weekly and monthly MSGF consumption vs
            proven savings — logged so you can review the table over time.
          </p>
        </header>

        <ShadowProxySavingsPanel tenantId={tenantId} />

        <PeriodSavingsReportsPanel tenantId={tenantId} />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Daily governance archives</h2>
          <DailyReportsAccordion />
        </section>
      </main>
    </div>
  );
}
