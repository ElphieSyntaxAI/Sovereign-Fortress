/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { Suspense } from "react";

import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";
import { ShadowTrialPanel } from "@/app/_components/marketing/ShadowTrialPanel";

export const metadata = {
  title: "Free 24h Shadow Proxy trial | MSGF Gated AI",
  description:
    "Prove projected bill savings in zero-latency Shadow mode. Live dashboard + email report at end of trial.",
};

type PageProps = {
  searchParams: Promise<{ t?: string }>;
};

export default async function ShadowTrialPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params.t?.trim() || null;

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Suspense fallback={null}>
          <ShadowTrialPanel statusToken={token} />
        </Suspense>
      </main>
    </div>
  );
}
