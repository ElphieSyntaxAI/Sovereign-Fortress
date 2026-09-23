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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountBillingPanel } from "@/app/account/AccountBillingPanel";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata = {
  title: "Account | MSGF",
  description: "Account, billing, and subscription settings.",
};

export default async function AccountPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/sign-in?next=/account");
  }

  const admin = createAdminClient();
  const access = await resolveDashboardAccessForUser(user);

  const { data: profile } = await admin
    .from("p4_profiles")
    .select("stripe_subscription_status, stripe_customer_id, company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripeStatus =
    typeof profile?.stripe_subscription_status === "string"
      ? profile.stripe_subscription_status
      : "none";
  const companyId =
    typeof profile?.company_id === "string" && profile.company_id.trim()
      ? profile.company_id.trim()
      : null;

  let seatLimit: number | null = null;
  if (companyId) {
    const { data: company } = await admin
      .from("msgf_companies")
      .select("seat_limit")
      .eq("id", companyId)
      .maybeSingle();
    if (typeof company?.seat_limit === "number") {
      seatLimit = company.seat_limit;
    }
  }

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <DashboardNav
        userEmail={user.email ?? "Signed in"}
        showAdminPortalLink={access.canAccessAdminDashboard}
      />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:pt-14">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Account
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your <span className="text-gradient-jewel">billing &amp; profile</span>
          </h1>
          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            Cards, invoices, membership, and saved reports.
          </p>
        </header>

        <AccountBillingPanel email={user.email ?? "—"} status={stripeStatus} />
        {seatLimit != null ? (
          <p className="mt-4 text-sm text-slate-400">Seat limit: {seatLimit}</p>
        ) : null}
        <p className="mt-6 text-sm">
          <Link href="/forgot-password" className="text-cyan-400 underline-offset-4 hover:underline">
            Reset password
          </Link>
        </p>
      </main>
    </div>
  );
}
