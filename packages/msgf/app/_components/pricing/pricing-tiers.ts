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
import type { PricingTierConfig } from "./PricingCard";

export const PRICING_TIERS: PricingTierConfig[] = [
  {
    id: "indie",
    name: "Individual Indie (BYOK)",
    priceLabel: "$0",
    priceSuffix: "/ forever",
    description:
      "Local six-domain tracking with complete project data isolation.",
    bullets: [
      "Local 6-domain tracking metrics",
      "Complete local project data isolation",
      "Bring your own keys for Claude, Gemini, and optional Grok — dual or three-model consensus when you wire keys",
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
      "Includes 1 year of managed cloud consensus (1,200 verification credits / month)",
      "Zero configuration — Claude / Gemini / Grok three-model path on our cloud when enabled",
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
      "Multi-tenant corporate workspace with human review, audit console, Session Replay, budgets, and SIEM.",
    bullets: [
      "Multi-tenant corporate workspace scopes",
      "Global human review + trusted-OSS bulk triage + signed audit snapshots",
      "Audit console, Session Replay, security event log, most-used resources, model fitness, diff impact",
      "Tenant budgets / circuit breaker + SIEM webhook export",
      "Sentry quarantine + Workspace SSO",
      "Custom company policy packs, Workspace SSO, and shared incident review logs",
    ],
    cta: {
      kind: "stripe_checkout",
      label: "Start team checkout",
      plan: "startup_team",
    },
  },
];
