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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
import Link from "next/link";

import { DASHBOARD_QUICK_LINKS } from "@/app/_components/marketing/shipped-capabilities";

export function ShippedCapabilitiesStrip() {
  return (
    <section
      className="glass-panel rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 via-slate-950/40 to-violet-950/25 p-5 sm:p-6"
      aria-label="Shipped capabilities"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            Shipped
          </p>
          <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
            IDE verify · TRI/Grok · audit hub · Session Replay — live on your tenant
          </h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Connect{" "}
            <strong className="font-medium text-slate-200">MSGF Pulse Guard</strong>, run Safe Build
            or Run Scripts, pick CONVERGE presets under{" "}
            <a href="#token-savings" className="text-amber-300/90 underline-offset-2 hover:underline">
              token savings
            </a>
            , and open{" "}
            <Link href="/admin/ops" className="text-violet-300/90 underline-offset-2 hover:underline">
              /admin/ops
            </Link>{" "}
            for audit hub, Session Replay, budgets, SIEM, Sentry quarantine, and Workspace SSO
            when configured. Vault (approved outcomes) and Hall (rejected outcomes) update from verify even when frontier consensus is
            idle.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end"
          aria-label="Capability shortcuts"
        >
          {DASHBOARD_QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-slate-600/50 bg-slate-900/60 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-emerald-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
