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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import { Suspense } from "react";

import { AdminArbitrateAuditPanel } from "@/app/_components/admin/ops/AdminArbitrateAuditPanel";
import { AdminArbitrateSection } from "@/app/_components/admin/ops/AdminArbitrateSection";
import { AdminAuditHubPanel } from "@/app/_components/admin/ops/AdminAuditHubPanel";
import { AdminBetaWaitlistPanel } from "@/app/_components/admin/ops/AdminBetaWaitlistPanel";
import { AdminBugInboxPanel } from "@/app/_components/admin/ops/AdminBugInboxPanel";
import { AdminDiffImpactPanel } from "@/app/_components/admin/ops/AdminDiffImpactPanel";
import { AdminModelFitnessPanel } from "@/app/_components/admin/ops/AdminModelFitnessPanel";
import { AdminMostUsedResourcesPanel } from "@/app/_components/admin/ops/AdminMostUsedResourcesPanel";
import { AdminPromptTemplatesPanel } from "@/app/_components/admin/ops/AdminPromptTemplatesPanel";
import { AdminProvenanceSearchPanel } from "@/app/_components/admin/ops/AdminProvenanceSearchPanel";
import { AdminSentryPanel } from "@/app/_components/admin/ops/AdminSentryPanel";
import { AdminSessionReplayPanel } from "@/app/_components/admin/ops/AdminSessionReplayPanel";
import { AdminSiemIntegrationsPanel } from "@/app/_components/admin/ops/AdminSiemIntegrationsPanel";
import { AdminSkipAuditPanel } from "@/app/_components/admin/ops/AdminSkipAuditPanel";
import { AdminTenantBudgetPanel } from "@/app/_components/admin/ops/AdminTenantBudgetPanel";
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
          Audit hub, Session Replay, most-used resources, trusted-OSS bulk ARBITRATE, prompt
          templates, quarantine, SIEM — one ops surface.
        </p>
      </header>

      <Suspense fallback={null}>
        <OpsProjectOriginStrip />
      </Suspense>
      <AdminAuditHubPanel />
      <AdminSessionReplayPanel />
      <AdminPromptTemplatesPanel />
      <AdminModelFitnessPanel />
      <AdminMostUsedResourcesPanel />
      <AdminDiffImpactPanel />
      <AdminTenantBudgetPanel />
      <AdminSiemIntegrationsPanel />
      <AdminBetaWaitlistPanel />
      <AdminBugInboxPanel />
      <Suspense fallback={null}>
        <AdminProvenanceSearchPanel />
      </Suspense>
      <div id="arbitrate">
        <AdminArbitrateSection hideDeveloperKeystrokes />
      </div>
      <Suspense fallback={null}>
        <AdminArbitrateAuditPanel />
      </Suspense>
      <AdminVaultQuarantinePanel />
      <Suspense fallback={null}>
        <AdminSkipAuditPanel />
      </Suspense>
      <AdminSentryPanel />
    </main>
  );
}
