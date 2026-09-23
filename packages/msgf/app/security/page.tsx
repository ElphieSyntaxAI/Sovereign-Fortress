import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardHashRedirect } from "@/app/_components/dashboard/DashboardHashRedirect";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { SecurityHome } from "@/app/_components/dashboard/SecurityHome";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { listUserProjects } from "@/lib/services/user-projects";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ project_origin?: string }>;
}) {
  const params = await searchParams;
  const projectOrigin = params.project_origin?.trim() ?? "";
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect("/sign-in?next=/security");
  }

  const admin = createAdminClient();
  const access = await resolveDashboardAccessForUser(user);
  const { data: buyerProfile } = await admin
    .from("p4_profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const tenantId =
    (typeof buyerProfile?.tenant_id === "string" && buyerProfile.tenant_id.trim()) || user.id;
  const projects = await listUserProjects(admin, user.id).catch(() => []);

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <DashboardHashRedirect />
      <DashboardNav
        userEmail={user.email ?? "Signed in"}
        showAdminPortalLink={access.canAccessAdminDashboard}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-300/90">Security</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-50">Policy, incidents, and heal</h1>
        </header>
        <SecurityHome
          tenantId={tenantId}
          projectOrigin={projectOrigin}
          allowHumanArbitration={access.canAccessAdminDashboard}
          mappedProjects={projects.map((project) => ({
            project_origin: project.project_origin,
            label: project.display_name?.trim() || project.project_origin,
          }))}
        />
      </main>
    </div>
  );
}
