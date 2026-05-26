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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { ProjectSetupClient } from "@/app/setup/projects/ProjectSetupClient";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Project setup · Elphie Syntax",
  description:
    "Map local folders and GitHub repositories so MSGF scopes dashboard health and environmental usage to your work.",
};

export default async function ProjectSetupPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/sign-in?next=/setup/projects");
  }

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <DashboardNav userEmail={user.email ?? "Signed in"} />
      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            Local blueprint setup
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient-jewel">Map your projects</span>
          </h1>
          <p className="text-sm text-slate-400">
            Register each monorepo app as its own workspace (Author, MSGF, Syntax Educates, etc.) — not
            only the repository root. MSGF scopes pillar health, eco savings, and Small Brain heals per{" "}
            <code className="text-violet-200">project_origin</code> tag.
          </p>
        </header>
        <ProjectSetupClient />
      </main>
    </div>
  );
}
