import type { PricingTierConfig } from "./PricingCard";

export const PRICING_TIERS: PricingTierConfig[] = [
  {
    id: "indie",
    name: "Individual Indie (BYOK)",
    priceLabel: "$0",
    priceSuffix: "/ forever",
    description:
      "Fully open local six-pillar tracking with complete project data isolation.",
    bullets: [
      "Fully open local 6-Pillar tracking metrics",
      "Complete local project data isolation",
      "Requires personal API keys in .msgf/keys/ for cloud consensus checks",
    ],
    cta: {
      kind: "extension_download",
      label: "Download IDE extension",
    },
  },
  {
    id: "pro",
    name: "Individual Pro (Perpetual License)",
    priceLabel: "$99",
    priceSuffix: "one-time",
    description: "Own the software forever. Year 1 managed cloud consensus included.",
    bullets: [
      "Own the software forever",
      "Includes 1 Year of Managed Cloud Consensus Core (1,200 verification slices / month)",
      "Zero configuration — runs on our optimized cloud infrastructure keys",
      "Falls back gracefully to 100% BYOK mode after Year 1 if you skip cloud maintenance renewal",
    ],
    featured: true,
    cta: {
      kind: "stripe_checkout",
      label: "Buy once — $99",
      plan: "pro_individual",
    },
  },
  {
    id: "startup",
    name: "Startup Team Tier",
    priceLabel: "$49",
    priceSuffix: "/ user / mo",
    description:
      "Multi-tenant corporate workspace with ARBITRATE consoles and shared incident logs.",
    bullets: [
      "Multi-tenant corporate workspace organization scopes",
      "Global ARBITRATE administrative command consoles",
      "Custom company-wide P1 rulebooks and shared team incident review logs",
    ],
    cta: {
      kind: "stripe_checkout",
      label: "Start team checkout",
      plan: "startup_team",
    },
  },
];
