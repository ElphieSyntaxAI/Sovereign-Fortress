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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * /roadmap — public interactive roadmap explorer (beta on production hosts).
 * ?product=author|msgf|education selects the initial tab.
 */
import type { Metadata } from "next";

import { AuthorRoadmapDeepDive } from "@elphie-syntax/ui/author-roadmap";
import { PlatformRoadmapExplorer } from "@elphie-syntax/ui/platform-roadmap";
import type { PlatformHubEntry } from "@elphie-syntax/core";

import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

export const metadata: Metadata = {
  title: "Roadmap · Elphie Syntax",
  description:
    "Explore MSGF beta features, Author foundational testing, and Syntax Education in development — live trials and signup on production.",
};

function resolveInitialProduct(
  product: string | undefined
): PlatformHubEntry["id"] {
  if (product === "author" || product === "education" || product === "msgf") {
    return product;
  }
  return "msgf";
}

type PageProps = {
  searchParams: Promise<{ product?: string }>;
};

export default async function RoadmapPage({ searchParams }: PageProps) {
  const { product } = await searchParams;
  const initialProductId = resolveInitialProduct(product);

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto max-w-6xl space-y-14 px-5 py-12 sm:py-16">
        <PlatformRoadmapExplorer variant="full" initialProductId={initialProductId} />
        {initialProductId === "author" ? <AuthorRoadmapDeepDive /> : null}
      </main>
    </div>
  );
}
