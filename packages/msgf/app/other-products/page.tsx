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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProductExplorerSection } from "@/app/_components/dashboard/ProductExplorerSection";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata = {
  title: "Other products | MSGF",
  description: "Author Ecosystem and Syntax Education — powered by MSGF.",
};

export default async function OtherProductsPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/sign-in?next=/other-products");
  }

  const access = await resolveDashboardAccessForUser(user);

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <DashboardNav
        userEmail={user.email ?? "Signed in"}
        showAdminPortalLink={access.canAccessAdminDashboard}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:py-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Product family
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gradient-jewel">Other products</span>
          </h1>
          <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
            Your MSGF dashboard stays focused on policy, routing, and token cost. Explore Author and
            Education here when you need those surfaces.
          </p>
          <Link
            href="/dashboard"
            className="inline-block text-sm font-medium text-emerald-400/90 underline-offset-4 hover:underline"
          >
            ← Back to MSGF dashboard
          </Link>
        </header>
        <ProductExplorerSection filter="sibling_products" />
      </main>
    </div>
  );
}
