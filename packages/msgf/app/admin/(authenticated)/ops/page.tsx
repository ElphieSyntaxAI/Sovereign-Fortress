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
import { AdminArbitrateSection } from "@/app/_components/admin/ops/AdminArbitrateSection";
import { AdminDocuSignPanel } from "@/app/_components/admin/ops/AdminDocuSignPanel";

export default function AdminOpsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
          MSGF operator ops
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient-jewel">Ops console</span>
        </h1>
        <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
          Live ARBITRATE incident queue and team DocuSign compliance — same APIs as the Vite
          msgf-dashboard, authenticated with your admin session (no service-role token in the browser).
        </p>
      </header>

      <AdminArbitrateSection hideDeveloperKeystrokes />
      <AdminDocuSignPanel />
    </main>
  );
}
