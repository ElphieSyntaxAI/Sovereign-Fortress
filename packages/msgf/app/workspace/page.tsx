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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
import Link from "next/link";

import { cookies, headers } from "next/headers";

import { redirect } from "next/navigation";

import type { Metadata } from "next";



import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";

import { WorkspaceIdeSetup } from "@/app/_components/workspace/WorkspaceIdeSetup";

import { loadWorkspaceContext } from "@/lib/workspace-context";

import { resolveIdeTenantKey, resolveMsgfAppOrigin } from "@/lib/workspace-ide-setup";

import { createAdminClient } from "@/utils/supabase/admin";

import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";



export const metadata: Metadata = {

  title: "Workspace · Elphie's Gated AI",

  description: "IDE setup, projects, and personal MSGF scope.",

};



function shortId(uuid: string): string {

  return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;

}



export default async function WorkspacePage() {

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

  const apiUrl = resolveMsgfAppOrigin(requestHost);

  const preferredOrigin = ctx.projects[0]?.project_origin ?? null;

  const tenantKey = resolveIdeTenantKey(user.id, preferredOrigin);



  return (

    <div className="landing-mesh min-h-screen text-slate-100">

      <DashboardNav userEmail={ctx.email} />

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">

        <header className="space-y-2">

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">

            Your workspace

          </p>

          <h1 className="text-3xl font-bold tracking-tight">

            <span className="text-gradient-jewel">Setup & projects</span>

          </h1>

          <p className="text-sm text-slate-400">

            Connect your editor first, then map repos so the governance dashboard reflects{" "}

            <strong className="text-slate-200">your</strong> pillar health — not platform-wide

            telemetry.

          </p>

        </header>



        <WorkspaceIdeSetup

          apiUrl={apiUrl}

          tenantKey={tenantKey}

          projectCount={ctx.projectCount}

        />



        {ctx.isNewWorkspace ? (

          <section className="glass-panel rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">

            <p className="text-sm font-medium text-amber-100">Next: map a project</p>

            <p className="mt-2 text-sm text-slate-300">

              After the extension is running, register the folder you opened in the IDE so dashboard

              metrics stay scoped to your code.

            </p>

            <Link

              href="/setup/projects"

              className="mt-4 inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-500/25"

            >

              Map your first project →

            </Link>

          </section>

        ) : null}



        <section className="glass-panel rounded-2xl border border-cyan-500/20 p-6">

          <h2 className="text-lg font-semibold text-slate-100">Account scope</h2>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">

            <div>

              <dt className="text-slate-500">Access role</dt>

              <dd className="font-medium text-cyan-100">{ctx.accessRole}</dd>

            </div>

            <div>

              <dt className="text-slate-500">IDE tenant key</dt>

              <dd className="font-mono text-xs text-cyan-200/90">{tenantKey}</dd>

            </div>

            <div>

              <dt className="text-slate-500">Company silo</dt>

              <dd className="font-medium text-slate-200">

                {ctx.companyId ? shortId(ctx.companyId) : "Independent (personal sandbox)"}

              </dd>

            </div>

            <div>

              <dt className="text-slate-500">Mapped projects</dt>

              <dd className="font-medium text-slate-200">{ctx.projectCount}</dd>

            </div>

            <div className="sm:col-span-2">

              <dt className="text-slate-500">Governance dashboard</dt>

              <dd>

                <Link href="/dashboard" className="font-medium text-emerald-300 hover:underline">

                  Personal pillar health →

                </Link>

              </dd>

            </div>

          </dl>

          {ctx.canAccessAdminDashboard ? (

            <p className="mt-4 text-sm text-slate-400">

              Operator tools:{" "}

              <Link href="/admin/portal" className="text-violet-300 hover:underline">

                Admin portal

              </Link>{" "}

              ·{" "}

              <Link href="/admin/dashboard" className="text-violet-300 hover:underline">

                Ops dashboard

              </Link>

            </p>

          ) : null}

        </section>



        <section className="glass-panel rounded-2xl border border-emerald-500/20 p-6">

          <h2 className="text-lg font-semibold text-slate-100">Your projects</h2>

          {ctx.projects.length === 0 ? (

            <p className="mt-3 text-sm text-slate-400">No projects mapped yet.</p>

          ) : (

            <ul className="mt-4 space-y-3">

              {ctx.projects.map((p) => (

                <li

                  key={p.id}

                  className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3"

                >

                  <p className="font-medium text-slate-100">{p.display_name}</p>

                  <p className="mt-1 font-mono text-xs text-cyan-200/90">{p.project_origin}</p>

                  <p className="mt-1 text-xs text-slate-500">

                    {p.source_type === "local" ? p.local_path : p.github_url}

                  </p>

                </li>

              ))}

            </ul>

          )}

          <Link

            href="/setup/projects"

            className="mt-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"

          >

            {ctx.projectCount > 0 ? "Manage projects" : "Add a project"} →

          </Link>

        </section>

      </main>

    </div>

  );

}


