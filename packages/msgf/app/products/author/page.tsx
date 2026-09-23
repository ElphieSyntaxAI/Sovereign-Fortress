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
import type { Metadata } from "next";

import { platformHubEntryById } from "@elphie-syntax/core";

import { ProductDetailShell } from "@/app/_components/products/ProductDetailShell";
import { canAccessPrelaunchProducts } from "@/lib/prelaunch-product-access";

export const metadata: Metadata = {
  title: "Author Ecosystem · Elphie Syntax",
  description:
    "Manuscript workspace for authors — authorship attestation, no-training agreement (Vault Pact), revision cooldown, dual Librarian + Critic review, and publisher discovery.",
};

const AUTHOR_ENTRY = platformHubEntryById("author");

export default async function Page() {
  const canOpenPrelaunch = await canAccessPrelaunchProducts();
  const liveUrl = canOpenPrelaunch
    ? process.env.AUTHOR_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_AUTHOR_APP_URL?.trim() ||
      "https://authorecosystem.elphiesyntax.com"
    : "https://authorecosystem.elphiesyntax.com/roadmap";

  const phases =
    AUTHOR_ENTRY?.phases.map((p) => ({
      label: p.label,
      status: p.status,
      highlights: [...p.highlights],
    })) ?? [];

  return (
    <ProductDetailShell
      tone="amethyst"
      platformId="author"
      eyebrow="Authors · editors · publishers"
      title="Author Ecosystem"
      tagline={AUTHOR_ENTRY?.tagline ?? "Manuscript workspace on authorecosystem."}
      vision="Author Ecosystem is a manuscript workspace: document ingest maps planning docs into wiki, outline, and world bible; authorship attestation records how the work arrived; the Vault Pact is the no-training agreement; MSGF is the AI gateway for routing and token-cost visibility; revision cooldown and dual review (Librarian + Critic) are the Phase 2 professional path."
      liveUrl={liveUrl}
      liveLabel={canOpenPrelaunch ? "Open Author dashboard" : "Author roadmap on authorecosystem"}
      roadmapDocPath="docs/author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md"
      metrics={[
        { label: "Phase 1", value: "~78%", hint: "Foundation · foundational testing" },
        { label: "Overall", value: "~48%", hint: "Phases 1–3 weighted" },
        { label: "MSGF governance", value: "~85%", hint: "Shadow/Active + verify-result" },
        { label: "Author tiers", value: "5", hint: "Free → $199.99 / mo" },
      ]}
      phases={phases}
      pillarRows={[
        { pillar: "MSGF P1", capability: "Vault Pact / publisher legal floor", notes: "No-training agreement" },
        { pillar: "MSGF P3", capability: "Author identity + tiered entitlements", notes: "Tier 1–5 (Free → $199.99)" },
        { pillar: "MSGF P4", capability: "Authorship attestation", notes: "Extension + sandbox telemetry" },
        { pillar: "MSGF P6", capability: "Lore store + Librarian RAG", notes: "Dual review (Librarian + Critic)" },
      ]}
      footnotes={[
        "Source: docs/author-ecosystem/AUTHOR_ECOSYSTEM_ROADMAP.md · SSOT UI: packages/core/src/lib/author-roadmap-content.ts",
        "Public roadmap: authorecosystem.elphiesyntax.com/roadmap · elphiesgatedai …/roadmap?product=author",
      ]}
    />
  );
}
