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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { WorkspaceView, type WorkspaceTabId } from "@/app/_components/workspace/WorkspaceView";
import { WorkspaceMsgfSentinel } from "@/app/_components/workspace/WorkspaceMsgfSentinel";
import { filterNavLinksForPermissions } from "@/lib/platform-rbac";
import { DASHBOARD_PRIMARY_LINKS } from "@/app/_components/dashboard/dashboard-nav-links";
import { loadWorkspaceContext } from "@/lib/workspace-context";
import { resolveIdeTenantKey, resolveMsgfAppOrigin } from "@/lib/workspace-ide-setup";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Workspace · Elphie's Gated AI",
  description: "Map projects, mint IDE tokens, and connect Pulse Guard in one place.",
};

function shortId(uuid: string): string {
  return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
}

function parseTab(raw: string | undefined): WorkspaceTabId | undefined {
  if (raw === "setup" || raw === "architecture") return "architecture";
  if (raw === "ide") return "ide";
  return undefined;
}

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ project_origin?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const initialProjectOrigin = params.project_origin?.trim() || null;
  const initialTab = parseTab(params.tab?.trim());

  const cookieStore = await cookies();
  const hdrs = await headers();
  const requestHost = requestHostFromHeaders(hdrs);
  const supabase = createClient(cookieStore, requestHost);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in?next=/workspace");
  }

  const admin = createAdminClient();
  const ctx = await loadWorkspaceContext(admin, user);

  if (!ctx.permissions.canAccessWorkspace) {
    redirect("/dashboard");
  }

  const apiUrl = resolveMsgfAppOrigin(requestHost);
  const preferredOrigin = initialProjectOrigin ?? ctx.projects[0]?.project_origin ?? null;
  const tenantKey = resolveIdeTenantKey(user.id, preferredOrigin);

  const companySilo = ctx.isIndependent
    ? "Independent personal sandbox"
    : ctx.companyId
      ? shortId(ctx.companyId)
      : "Company workspace";

  const navFilter = filterNavLinksForPermissions(
    DASHBOARD_PRIMARY_LINKS("/dashboard#token-savings"),
    ctx.permissions
  );

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <DashboardNav
        userEmail={ctx.email}
        showAdminPortalLink={ctx.canAccessAdminDashboard}
        tokenSavingsHref="/dashboard#token-savings"
        primaryLinksOverride={navFilter}
      />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-5 sm:py-10">
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Developer workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gradient-jewel">Workspace</span>
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400 sm:mx-0 sm:text-base">
            Map repositories, mint long-lived IDE tokens, and verify Pulse Guard — scoped to your
            pillar health and governance dashboard.
          </p>
        </header>

        <WorkspaceView
          apiUrl={apiUrl}
          accessRole={ctx.accessRole}
          companySilo={companySilo}
          tenantKey={tenantKey}
          initialProjects={ctx.projects}
          initialTab={initialTab ?? (initialProjectOrigin ? "ide" : undefined)}
          initialProjectOrigin={initialProjectOrigin}
          isNewWorkspace={ctx.isNewWorkspace}
          canAccessAdminDashboard={ctx.canAccessAdminDashboard}
          permissions={ctx.permissions}
        />
      </main>
      <WorkspaceMsgfSentinel tenantKey={tenantKey} userId={user.id} />
    </div>
  );
}
