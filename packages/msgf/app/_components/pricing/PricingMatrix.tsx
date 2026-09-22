"use client";

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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T170731Z-internal
 */
import { useState } from "react";

import { PricingCard } from "./PricingCard";
import { pricingTiersForInterval, type CheckoutInterval } from "./pricing-tiers";

function intervalButtonClass(active: boolean) {
  return active
    ? "rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-[#f8fafc] shadow-[0_0_18px_rgba(16,185,129,0.28)]"
    : "rounded-full px-5 py-2 text-sm font-medium text-slate-300 hover:text-[#f8fafc]";
}

export function PricingMatrix() {
  const [interval, setInterval] = useState<CheckoutInterval>("month");
  const tiers = pricingTiersForInterval(interval);

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-3">
        <div
          className="inline-flex rounded-full border border-slate-700/80 bg-slate-950/60 p-1"
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            aria-pressed={interval === "month"}
            className={intervalButtonClass(interval === "month")}
            onClick={() => setInterval("month")}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={interval === "year"}
            className={intervalButtonClass(interval === "year")}
            onClick={() => setInterval("year")}
          >
            Yearly
          </button>
        </div>
        <p className="text-xs text-emerald-300/80">
          Yearly billing is 10 months for the price of 12.
        </p>
      </div>

      <div className="pricing-matrix-grid mx-auto grid max-w-7xl gap-8 md:grid-cols-2 md:items-stretch xl:grid-cols-4 xl:gap-6">
        {tiers.map((tier) => (
          <PricingCard key={tier.id} tier={tier} />
        ))}
      </div>
    </div>
  );
}
