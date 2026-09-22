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

import { AdminPortalNav } from "@/app/_components/admin/AdminPortalNav";
import { isStagingDeploy } from "@/lib/deploy-env";
import {
  assertSessionOperatorIsAdmin,
  resolveSessionDashboardOperator,
} from "@/lib/msgf-admin-session";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/admin/sign-in?next=/admin/portal");
  }

  const admin = createAdminClient();
  const op = await resolveSessionDashboardOperator(admin, user);

  try {
    assertSessionOperatorIsAdmin(op);
  } catch {
    redirect("/unauthorized");
  }

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AdminPortalNav
        userEmail={user.email ?? "Signed in"}
        showSeed={isStagingDeploy()}
      />
      {children}
    </div>
  );
}
