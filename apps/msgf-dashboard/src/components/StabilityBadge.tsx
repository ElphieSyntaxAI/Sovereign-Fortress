import type { BrainStabilityTier } from "../lib/decision-portal";

const BADGE_STYLES: Record<
  BrainStabilityTier,
  { label: string; className: string }
> = {
  green: {
    label: "Stable",
    className:
      "border-emerald-700/70 bg-emerald-950/60 text-emerald-200 ring-emerald-900/40",
  },
  yellow: {
    label: "Caution",
    className: "border-amber-700/70 bg-amber-950/60 text-amber-200 ring-amber-900/40",
  },
  red: {
    label: "High risk",
    className: "border-red-800/70 bg-red-950/60 text-red-200 ring-red-900/40",
  },
};

export function StabilityBadge({ tier }: { tier: BrainStabilityTier }) {
  const { label, className } = BADGE_STYLES[tier];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${className}`}
      title={`Brain stability: ${label}`}
    >
      {label}
    </span>
  );
}
