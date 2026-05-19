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
  const initialReport = await healthService.getPillarHealth(admin, {
    userId: user.id,
    lookbackHours: 168,
  });

  return (
    <DashboardShell userEmail={user.email ?? "Signed in"} initialReport={initialReport} />
  );
}
