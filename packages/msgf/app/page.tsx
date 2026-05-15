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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
import Link from "next/link";

import { getSystemConnectionStatus } from "@msgf/lib/system-connection-status";

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
          aria-hidden
        />
        <span className="font-medium text-zinc-100">{label}</span>
      </div>
      <p className="text-sm text-zinc-400 sm:text-right">{detail}</p>
    </div>
  );
}

export default async function Page() {
  const { gcp, anthropic, stripe } = getSystemConnectionStatus();

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">System status</h1>
        <p className="text-sm text-zinc-400">
          Local configuration only — no live health checks. Amber means missing env or files expected for that
          integration.
        </p>
      </div>

      <div className="space-y-3">
        <StatusRow {...gcp} />
        <StatusRow {...anthropic} />
        <StatusRow {...stripe} />
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-400">
        <Link href="/todos" className="text-zinc-200 underline-offset-4 hover:underline">
          Todos (Supabase SSR demo)
        </Link>
        <Link href="/audit-log" className="text-zinc-200 underline-offset-4 hover:underline">
          Audit log (RLS test)
        </Link>
      </p>
    </main>
  );
}
