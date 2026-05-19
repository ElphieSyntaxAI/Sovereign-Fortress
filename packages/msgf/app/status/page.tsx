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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
 */
import Link from "next/link";

import { getSystemConnectionStatus } from "@msgf/lib/system-connection-status";

import { LandingNav } from "@/app/_components/landing/LandingNav";

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="glass-panel flex flex-col gap-1 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
          aria-hidden
        />
        <span className="font-medium text-slate-100">{label}</span>
      </div>
      <p className="text-sm text-slate-400 sm:text-right">{detail}</p>
    </div>
  );
}

export default function StatusPage() {
  const { gcp, anthropic, stripe } = getSystemConnectionStatus();

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <LandingNav />
      <main className="mx-auto max-w-xl space-y-6 px-5 py-10">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">System status</h1>
          <p className="text-sm text-slate-400">
            Local configuration only — no live health checks. Amber means missing env or files expected for that
            integration.
          </p>
        </div>

        <div className="space-y-3">
          <StatusRow {...gcp} />
          <StatusRow {...anthropic} />
          <StatusRow {...stripe} />
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
          <Link href="/todos" className="text-emerald-300 underline-offset-4 hover:underline">
            Todos (Supabase SSR demo)
          </Link>
          <Link href="/audit-log" className="text-violet-300 underline-offset-4 hover:underline">
            Audit log (RLS test)
          </Link>
          <Link href="/" className="text-slate-300 underline-offset-4 hover:underline">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}
