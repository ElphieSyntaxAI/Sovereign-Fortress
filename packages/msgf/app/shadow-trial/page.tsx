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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import { Suspense } from "react";

import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";
import { ShadowTrialPanel } from "@/app/_components/marketing/ShadowTrialPanel";

export const metadata = {
  title: "Free 7-day shadow-mode trial | MSGF",
  description:
    "Prove projected bill savings in observe-only shadow mode. Clock starts on first call. Then start 3-day Individual Pro full access.",
};

type PageProps = {
  searchParams: Promise<{ t?: string; full?: string }>;
};

export default async function ShadowTrialPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.t?.trim() || null;
  const startFullAccess = params.full === "1" || params.full === "true";

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Suspense fallback={null}>
          <ShadowTrialPanel statusToken={token} startFullAccess={startFullAccess} />
        </Suspense>
      </main>
    </div>
  );
}
