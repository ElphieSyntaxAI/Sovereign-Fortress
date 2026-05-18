/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "@/app/_components/dashboard/DashboardShell";
import { healthService } from "@/lib/services/HealthService";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

/**
 * Authenticated SaaS platform shell — six-pillar glass-box governance matrix.
 * Unauthenticated visitors are redirected to `/sign-in`.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

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
