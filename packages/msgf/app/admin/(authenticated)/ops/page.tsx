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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import { AdminArbitrateAuditPanel } from "@/app/_components/admin/ops/AdminArbitrateAuditPanel";
import { AdminArbitrateSection } from "@/app/_components/admin/ops/AdminArbitrateSection";
import { AdminDocuSignPanel } from "@/app/_components/admin/ops/AdminDocuSignPanel";
import { AdminSentryPanel } from "@/app/_components/admin/ops/AdminSentryPanel";
import { AdminSkipAuditPanel } from "@/app/_components/admin/ops/AdminSkipAuditPanel";
import { AdminVaultQuarantinePanel } from "@/app/_components/admin/ops/AdminVaultQuarantinePanel";

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
          ARBITRATE, signed HITL audit, Vault quarantine, Sentry, signing, and skip-MSGF — one
          ops surface. Prefer the same <code className="text-slate-300">project_origin</code> when
          filtering. Deploy gate:{" "}
          <code className="text-slate-300">GET /api/msgf/deploy-gate?project_origin=…</code>
        </p>
      </header>

      <AdminArbitrateSection hideDeveloperKeystrokes />
      <AdminArbitrateAuditPanel />
      <AdminVaultQuarantinePanel />
      <AdminSkipAuditPanel />
      <AdminSentryPanel />
      <AdminDocuSignPanel />
    </main>
  );
}
