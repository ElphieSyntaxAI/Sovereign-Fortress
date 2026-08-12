import type { Metadata } from "next";

import { platformHubEntryById } from "@elphie-syntax/core";

import { ProductDetailShell } from "@/app/_components/products/ProductDetailShell";
import { canAccessPrelaunchProducts } from "@/lib/prelaunch-product-access";

export const metadata: Metadata = {
  title: "Author Ecosystem · Elphie Syntax",
  description:
    "Sovereign narrative infrastructure for authors — HAL Ledger biometric proof, Vault Pact zero-training NDA, Cool Down revision locks, bicameral Librarian + Critic audit, and the Publisher Hub.",
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
      eyebrow="Creative Integrity Flywheel"
      title="Author Ecosystem"
      tagline={AUTHOR_ENTRY?.tagline ?? "Sovereign narrative infrastructure on authorecosystem."}
      vision="ElphieSyntax is sovereign narrative infrastructure: document ingest maps planning docs into wiki, outline, and world bible; HAL Ledger captures biometric authorship proof; the Vault Pact enforces zero-training and no-human-browsing; MSGF Gated AI powers Pulse routing and token-savings visibility; Cool Down locks and bicameral audit (Librarian + Critic) are the Phase 2 professionalization path."
      liveUrl={liveUrl}
      liveLabel={canOpenPrelaunch ? "Open Author dashboard" : "Author roadmap on authorecosystem"}
      roadmapDocPath="docs/AUTHOR_ECOSYSTEM_ROADMAP.md"
      metrics={[
        { label: "Phase 1", value: "~78%", hint: "Foundation · foundational testing" },
        { label: "Overall", value: "~48%", hint: "Phases 1–3 weighted" },
        { label: "MSGF governance", value: "~85%", hint: "Shadow/Active + verify-result" },
        { label: "Author tiers", value: "5", hint: "Free → $199.99 / mo" },
      ]}
      phases={phases}
      pillarRows={[
        { pillar: "MSGF P1", capability: "Vault Pact / Publisher legal floor", notes: "NDA & zero-training contract" },
        { pillar: "MSGF P3", capability: "Author identity + tiered entitlements", notes: "Tier 1–5 (Free → $199.99)" },
        { pillar: "MSGF P4", capability: "HAL Ledger biometric capture", notes: "Extension + sandbox telemetry" },
        { pillar: "MSGF P6", capability: "Lore-Git Vault + Librarian RAG", notes: "Bicameral audit (Librarian + Critic)" },
      ]}
      footnotes={[
        "Source: docs/AUTHOR_ECOSYSTEM_ROADMAP.md · SSOT UI: packages/core/src/lib/author-roadmap-content.ts",
        "Public roadmap: authorecosystem.elphiesyntax.com/roadmap · elphiesgatedai …/roadmap?product=author",
      ]}
    />
  );
}
