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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
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
      tagline="From “Protecting the Work” to “Perfecting the Work.” Sovereign narrative infrastructure backed by the same MSGF brain — HAL telemetry, Vault Pact, Cool Down locks, and a bicameral audit path for publisher-grade proofs."
      vision="ElphieSyntax is a sovereign narrative infrastructure that transitions authors from protecting the work (sovereignty) to perfecting the work (professionalism). HAL Ledger captures biometric authorship proof; the Vault Pact enforces zero-training and no-human-browsing; Cool Down Locks impose professional distance; and the Bicameral Audit (Librarian + Critic) generates publisher-ready receipts."
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
          label: "Phase 1 — The Foundation (current WIP)",
          status: "In flight",
          highlights: [
            "HAL v2 Certificate — telemetry + Vault Seal + Lore-Git proof bundle",
            "Author RAG model — sidekick for continuity & outline adherence",
            "Progress tracking — word count + outline percentage",
            "Unified registration — atomic Auth + Profile + Pact + Legacy",
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
