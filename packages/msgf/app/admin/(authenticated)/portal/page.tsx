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
import Link from "next/link";
import type { Metadata } from "next";

import { AdminDevStackBanner } from "@/app/_components/admin/AdminDevStackBanner";
import { AdminProductLauncher } from "@/app/_components/admin/AdminProductLauncher";
import { getAdminProductSurfaces } from "@/lib/admin-product-surfaces";
import { probeLocalDevStack } from "@/lib/dev-stack-status";

export const metadata: Metadata = {
  title: "Admin portal · Elphie's Gated AI",
  description: "MSGF operator launchpad for Author Ecosystem and Syntax Education prelaunch testing.",
};

export default async function AdminPortalPage() {
  const surfaces = getAdminProductSurfaces();
  const devProbes =
    process.env.NODE_ENV === "development" ? await probeLocalDevStack() : [];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
          MSGF operator portal
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient-jewel">Test the product family</span>
        </h1>
        <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
          Open Author Ecosystem and Syntax Education from here. Pillar health and incident queues
          live on the{" "}
          <Link href="/admin/dashboard" className="text-violet-300 hover:underline">
            ops dashboard
          </Link>
          ; your personal stats stay on{" "}
          <Link href="/dashboard" className="text-emerald-300 hover:underline">
            governance dashboard
          </Link>
          .
        </p>
      </header>

      {devProbes.length > 0 ? <AdminDevStackBanner probes={devProbes} /> : null}

      <AdminProductLauncher surfaces={surfaces} />

      <section className="glass-panel rounded-2xl border border-amber-500/25 p-5 text-sm text-slate-300">
        <h2 className="text-base font-semibold text-amber-100">Token savings & efficiency (1.0)</h2>
        <p className="mt-2 text-slate-400">
          Operators see <strong className="text-cyan-300/90">Small Brain</strong> vs{" "}
          <strong className="text-violet-300/90">Big Brain</strong> on the{" "}
          <Link href="/admin/dashboard#token-savings" className="text-amber-300 hover:underline">
            ops dashboard
          </Link>
          . Tenants keep local logic (Vault, bypass, dev-event, cache replay); global CONVERGE and
          DNA promotion require admin approval via the Global Approval Gate.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          API: <code className="text-violet-300">GET /api/msgf/admin/dashboard/savings-features</code>{" "}
          · Docs: <code className="text-violet-300">packages/msgf/README.md</code> · Tests:{" "}
          <code className="text-violet-300">npm run test:savings -w msgf</code>
        </p>
      </section>

      <section className="glass-panel rounded-2xl border border-slate-600/30 p-5 text-sm text-slate-400">
        <h2 className="text-base font-semibold text-slate-200">Local stack checklist</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            <code className="text-violet-200">npm run dev -w msgf</code> — MSGF on port 3001 (3000 free for LIFF)
          </li>
          <li>
            Author BFF + client — <code className="text-violet-200">apps/author-ecosystem/server</code>{" "}
            (3002) and <code className="text-violet-200">client</code> (5173)
          </li>
          <li>
            Syntax Educates — <code className="text-violet-200">apps/syntax-educates</code> (5175,
            routes <code className="text-violet-200">/sandbox</code>,{" "}
            <code className="text-violet-200">/teacher</code>)
          </li>
          <li>
            Align <code className="text-violet-200">MSGF_AUTH_COOKIE_DOMAIN</code> in{" "}
            <code className="text-violet-200">packages/msgf/.env.local</code> for shared Supabase
            sessions across
            subdomains.
          </li>
        </ol>
      </section>
    </main>
  );
}
