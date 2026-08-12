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
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountBillingPortalButton } from "@/app/account/AccountBillingPortalButton";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata = {
  title: "Account | Elphie's Gated AI",
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
      : null;
  const hasCustomer =
    typeof profile?.stripe_customer_id === "string" &&
    Boolean(profile.stripe_customer_id.trim());
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

  const showTeamLink =
    access.operator.role === "COMPANY_ADMIN" ||
    access.operator.role === "GLOBAL_ADMIN";

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
            Subscription status and portal access for this signed-in user.
          </p>
        </header>

        <section className="glass-panel space-y-5 rounded-2xl border border-slate-600/30 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email
            </p>
            <p className="mt-1 text-slate-100">{user.email ?? "—"}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Subscription status
            </p>
            <p className="mt-1 text-slate-100">{stripeStatus ?? "none"}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stripe customer
            </p>
            <p className="mt-1 text-slate-100">{hasCustomer ? "linked" : "not linked"}</p>
          </div>

          {seatLimit != null ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Seat limit
              </p>
              <p className="mt-1 text-slate-100">{seatLimit}</p>
            </div>
          ) : null}

          <AccountBillingPortalButton disabled={!hasCustomer} />

          <div className="flex flex-wrap gap-4 border-t border-slate-800/80 pt-4 text-sm">
            <Link
              href="/forgot-password"
              className="text-cyan-400 underline-offset-4 hover:underline"
            >
              Reset password
            </Link>
            {showTeamLink ? (
              <Link
                href="/workspace"
                className="text-violet-300 underline-offset-4 hover:underline"
              >
                Team
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
