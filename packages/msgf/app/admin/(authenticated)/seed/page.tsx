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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { StagingReadinessSeed } from "@/app/_components/admin/StagingReadinessSeed";
import { isStagingDeploy } from "@/lib/deploy-env";

export const metadata: Metadata = {
  title: "Staging seed · MSGF",
  description: "Seed a staging tenant for product-readiness tests.",
};

export default function AdminSeedPage() {
  if (!isStagingDeploy()) notFound();

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
          Staging only
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient-jewel">Product-readiness seed</span>
        </h1>
        <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
          Create the operator, Checkout buyer, Pulse tenant, and Author license used for staging
          smoke. This page does not exist on production.
        </p>
      </header>
      <StagingReadinessSeed />
    </main>
  );
}
