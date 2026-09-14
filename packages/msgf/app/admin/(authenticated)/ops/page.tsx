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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import { Suspense } from "react";

import { AdminArbitrateAuditPanel } from "@/app/_components/admin/ops/AdminArbitrateAuditPanel";
import { AdminArbitrateSection } from "@/app/_components/admin/ops/AdminArbitrateSection";
import { AdminBetaWaitlistPanel } from "@/app/_components/admin/ops/AdminBetaWaitlistPanel";
import { AdminBugInboxPanel } from "@/app/_components/admin/ops/AdminBugInboxPanel";
import { AdminDocuSignPanel } from "@/app/_components/admin/ops/AdminDocuSignPanel";
import { AdminProvenanceSearchPanel } from "@/app/_components/admin/ops/AdminProvenanceSearchPanel";
import { AdminSentryPanel } from "@/app/_components/admin/ops/AdminSentryPanel";
import { AdminSkipAuditPanel } from "@/app/_components/admin/ops/AdminSkipAuditPanel";
import { AdminVaultQuarantinePanel } from "@/app/_components/admin/ops/AdminVaultQuarantinePanel";
import { OpsProjectOriginStrip } from "@/app/_components/admin/ops/OpsProjectOriginStrip";

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
          Bug inbox → ARBITRATE, provenance, quarantine, Sentry, signing, and skip-MSGF — one ops
          surface. Prefer the same <code className="text-slate-300">project_origin</code> when
          filtering.
        </p>
      </header>

      <Suspense fallback={null}>
        <OpsProjectOriginStrip />
      </Suspense>
      <AdminBetaWaitlistPanel />
      <AdminBugInboxPanel />
      <Suspense fallback={null}>
        <AdminProvenanceSearchPanel />
      </Suspense>
      <AdminArbitrateSection hideDeveloperKeystrokes />
      <Suspense fallback={null}>
        <AdminArbitrateAuditPanel />
      </Suspense>
      <AdminVaultQuarantinePanel />
      <Suspense fallback={null}>
        <AdminSkipAuditPanel />
      </Suspense>
      <AdminSentryPanel />
      <AdminDocuSignPanel />
    </main>
  );
}
