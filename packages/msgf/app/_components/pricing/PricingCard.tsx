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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
import { PricingCtaButton, type PricingCtaKind } from "./PricingCtaButton";

export type PricingTierConfig = {
  id: string;
  name: string;
  priceLabel: string;
  priceSuffix?: string;
  description: string;
  bullets: string[];
  featured?: boolean;
  cta: {
    kind: PricingCtaKind;
    label: string;
    plan?: "pro_individual" | "startup_team";
  };
};

type Props = {
  tier: PricingTierConfig;
};

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CardSheet({ tier }: Props) {
  return (
    <div className="pricing-ivory-sheet flex flex-1 flex-col rounded-2xl p-6 sm:p-7">
      <div className="mb-5">
        <h3 className="text-lg font-bold tracking-tight text-[#f8fafc]">{tier.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-emerald-100/75">{tier.description}</p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-[#faf8f5]">{tier.priceLabel}</span>
        {tier.priceSuffix ? (
          <span className="text-sm font-medium text-violet-200/70">{tier.priceSuffix}</span>
        ) : null}
      </div>

      <ul className="mb-8 flex flex-1 flex-col gap-3" role="list">
        {tier.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2.5 text-sm leading-relaxed text-[#e8e4df]">
            <CheckIcon />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <PricingCtaButton
        kind={tier.cta.kind}
        label={tier.cta.label}
        plan={tier.cta.plan}
        variant={tier.featured ? "featured" : tier.id === "indie" ? "outline" : "primary"}
      />
    </div>
  );
}

export function PricingCard({ tier }: Props) {
  if (tier.featured) {
    return (
      <article
        className="pricing-card pricing-card-featured relative flex flex-col rounded-[1.35rem] p-[2px] lg:scale-[1.02]"
        aria-labelledby={`pricing-${tier.id}`}
      >
        <span className="pricing-featured-badge absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f8fafc]">
          Featured
        </span>
        <div
          id={`pricing-${tier.id}`}
          className="flex flex-1 flex-col rounded-[1.25rem] bg-[#120a22]/95"
        >
          <CardSheet tier={tier} />
        </div>
      </article>
    );
  }

  return (
    <article
      className="pricing-card flex flex-col rounded-[1.25rem]"
      aria-labelledby={`pricing-${tier.id}`}
    >
      <div id={`pricing-${tier.id}`}>
        <CardSheet tier={tier} />
      </div>
    </article>
  );
}
