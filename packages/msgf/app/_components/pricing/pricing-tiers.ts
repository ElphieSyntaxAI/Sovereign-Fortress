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
import type { CheckoutInterval } from "@/lib/billing/stripe-checkout-types";
import type { PricingTierConfig } from "./PricingCard";

export type { CheckoutInterval };

const YEARLY_NOTE = "Pay yearly and get 2 months free.";

export function pricingTiersForInterval(interval: CheckoutInterval): PricingTierConfig[] {
  const yearly = interval === "year";

  return [
    {
      id: "indie",
      name: "BYOK",
      priceLabel: "$0",
      priceSuffix: yearly ? "/ yr" : "/ mo",
      description:
        "Hosted AI gateway on our Redis and Supabase. Bring your own model keys — no local database to stand up.",
      bullets: [
        "Hosted tenant — Redis and Supabase included",
        "Shadow mode + Pulse Guard on 1 mapped project",
        "Bring your own Claude, Gemini, and optional Grok keys",
        "Managed three-model consensus stays on Pro",
      ],
      cta: {
        kind: "link",
        label: "Start 7-day shadow-mode trial",
        href: "/shadow-trial",
      },
    },
    {
      id: "pro",
      name: "Pro",
      priceLabel: yearly ? "$290" : "$29",
      priceSuffix: yearly ? "/ yr" : "/ mo",
      description: yearly
        ? "Enforcement for independent developers. Billed annually."
        : "Enforcement for independent developers. $290 / year if you pay annually.",
      bullets: [
        "Enforcement mode, Vault, and Hall on the hosted gateway",
        "1,200 verification credits / month of managed consensus",
        "One-seat enforcement · Pulse Guard + policy-domain dashboard",
        "Eco Trio and custom endpoints for day-to-day routing",
      ],
      featured: true,
      cta: {
        kind: "stripe_checkout",
        label: yearly ? "Subscribe to Pro — $290/yr" : "Subscribe to Pro — $29/mo",
        plan: "pro_individual",
        interval,
      },
    },
    {
      id: "startup",
      name: "Startup",
      priceLabel: yearly ? "$490" : "$49",
      priceSuffix: yearly ? "/ workspace / yr" : "/ workspace / mo",
      description: yearly
        ? `One workspace for a small team — up to 5 people. ${YEARLY_NOTE}`
        : "One workspace for a small team — not per seat. Up to 5 people included.",
      bullets: [
        "Shared projects, roles, audit console, and tenant budgets",
        "Session Replay and Tri-Tribunal consensus",
        "Up to 5 people on one workspace",
        yearly ? "Extra seats $150 / yr — contact us" : "Extra seats $15 / mo — contact us",
      ],
      cta: {
        kind: "stripe_checkout",
        label: yearly ? "Start Startup — $490/yr" : "Start Startup — $49/mo",
        plan: "startup_team",
        interval,
      },
    },
    {
      id: "enterprise",
      name: "Enterprise",
      priceLabel: yearly ? "$1,990" : "$199",
      priceSuffix: yearly ? "/ workspace / yr" : "/ workspace / mo",
      description: yearly
        ? `SSO, SIEM, and Sentry quarantine on a dedicated workspace. ${YEARLY_NOTE}`
        : "SSO, SIEM, and Sentry quarantine on a dedicated workspace.",
      bullets: [
        "Everything in Startup",
        "Workspace SSO and company domains",
        "SIEM webhook export",
        "Sentry → Vault quarantine",
      ],
      cta: {
        kind: "stripe_checkout",
        label: yearly ? "Start Enterprise — $1,990/yr" : "Start Enterprise — $199/mo",
        plan: "enterprise",
        interval,
      },
    },
  ];
}

export const PRICING_TIERS: PricingTierConfig[] = pricingTiersForInterval("month");
