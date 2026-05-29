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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * /products/author — "Find out more" detail page for the Author Ecosystem surface.
 * Source of truth: docs/AUTHOR_ECOSYSTEM_ROADMAP.md (Creative Integrity Flywheel).
 */
import type { Metadata } from "next";

import { ProductDetailShell } from "@/app/_components/products/ProductDetailShell";
import { canAccessPrelaunchProducts } from "@/lib/prelaunch-product-access";

export const metadata: Metadata = {
  title: "Author Ecosystem · Elphie Syntax",
  description:
    "Sovereign narrative infrastructure for authors — HAL Ledger biometric proof, Vault Pact zero-training NDA, Cool Down revision locks, bicameral Librarian + Critic audit, and the Publisher Hub.",
};

export default async function Page() {
  const canOpenPrelaunch = await canAccessPrelaunchProducts();
  const liveUrl = canOpenPrelaunch
    ? process.env.AUTHOR_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_AUTHOR_APP_URL?.trim() ||
      null
    : null;

  return (
    <ProductDetailShell
      tone="amethyst"
      eyebrow="Creative Integrity Flywheel"
      title="Author Ecosystem"
      tagline="From “Protecting the Work” to “Perfecting the Work.” Document ingest (MSGF V3.2), HAL telemetry, Vault Pact, planning hub, and MSGF Pulse bridge — on authorecosystem.elphiesyntax.com."
      vision="ElphieSyntax is sovereign narrative infrastructure: document ingest maps planning docs into wiki, outline, and world bible; HAL Ledger captures biometric authorship proof; the Vault Pact enforces zero-training and no-human-browsing; MSGF Gated AI powers Pulse routing and token-savings visibility; Cool Down locks and bicameral audit (Librarian + Critic) are the Phase 2 professionalization path."
      liveUrl={liveUrl}
      liveLabel="Open Author dashboard"
      roadmapDocPath="docs/AUTHOR_ECOSYSTEM_ROADMAP.md"
      metrics={[
        { label: "Tiers", value: "5", hint: "Free → $199.99 / mo (SSOT)" },
        { label: "Publisher keys", value: "4 levels", hint: "From HAL average → full forensic" },
        { label: "Lock tiers (today)", value: "4w / 6w / 8w", hint: "+ 24h planning-sync cooldown" },
        { label: "Phases", value: "3", hint: "Foundation · Professionalize · Scale" },
      ]}
      phases={[
        {
          label: "Phase 1 — The Foundation (current)",
          status: "In flight · deploy-ready",
          highlights: [
            "Document ingest (MSGF V3.2) — Google Docs / uploads → wiki, outline, world bible",
            "HAL + MSGF Pulse bridge — token savings on elphiesgatedai dashboard",
            "Manuscript hub, planning command center, Vault Pact registration",
            "BFF on api.authorecosystem · client on authorecosystem",
          ],
        },
        {
          label: "Phase 2 — Professionalization (immediate focus)",
          status: "Next",
          highlights: [
            "Cool Down Revision Lock — read-only state gate with timer unlocks",
            "Revision reports — continuity, plot holes, market appeal",
            "Editor Suite — HAL scores + revision history for human editors",
            "Community Guild — verified translators, artists, voice actors",
          ],
        },
        {
          label: "Phase 3 — Scaling & Sovereignty",
          status: "Planned",
          highlights: [
            "Author growth tracking — vocabulary & craft analytics",
            "Multimedia Vault — video / audio (Patreon-style or Stripe-gated)",
            "Graph comparison — sales × multimedia engagement × AI insights",
            "Personality Lore Bots — character-specific RAG for fan interaction",
          ],
        },
      ]}
      pillarRows={[
        { pillar: "MSGF P1", capability: "Vault Pact / Publisher legal floor", notes: "NDA & zero-training contract" },
        { pillar: "MSGF P3", capability: "Author identity + tiered entitlements", notes: "Tier 1–5 (Free → $199.99)" },
        { pillar: "MSGF P4", capability: "HAL Ledger biometric capture", notes: "Extension + sandbox telemetry" },
        { pillar: "MSGF P6", capability: "Lore-Git Vault + Librarian RAG", notes: "Bicameral audit (Librarian + Critic)" },
      ]}
      footnotes={[
        "Source: docs/AUTHOR_ECOSYSTEM_ROADMAP.md · companion: docs/MONOREPO_PRODUCTS.md",
        "Engineering note: SSOT lock tiers and tier pricing supersede legacy `msgf_legacy_tiers` seeds.",
      ]}
    />
  );
}
