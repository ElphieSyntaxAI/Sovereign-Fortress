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
