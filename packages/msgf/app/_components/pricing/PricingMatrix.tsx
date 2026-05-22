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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
import { PricingCard } from "./PricingCard";
import { PRICING_TIERS } from "./pricing-tiers";

export function PricingMatrix() {
  return (
    <div className="pricing-matrix-grid mx-auto grid max-w-6xl gap-8 lg:grid-cols-3 lg:items-stretch lg:gap-6 xl:gap-8">
      {PRICING_TIERS.map((tier) => (
        <PricingCard key={tier.id} tier={tier} />
      ))}
    </div>
  );
}
