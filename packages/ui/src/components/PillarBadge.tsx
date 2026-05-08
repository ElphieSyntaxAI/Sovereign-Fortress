"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { pillarFromLineageLabel, type PillarId } from "../lib/lineage";

export type PillarBadgeProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  /** Full MSGF lineage label, e.g. `MSGF_V3_STRICT.constraint_ledger.1.1.1` */
  lineageLabel: string;
  /** Optional override when the label does not encode the pillar. */
  pillar?: PillarId | null;
};

const pillarStyles: Record<PillarId, string> = {
  P1: "border-red-500/60 bg-red-950/70 text-red-100 ring-red-500/30",
  P2: "border-orange-500/55 bg-orange-950/65 text-orange-100 ring-orange-500/25",
  P3: "border-amber-500/55 bg-amber-950/60 text-amber-100 ring-amber-500/25",
  P4: "border-sky-500/55 bg-sky-950/65 text-sky-100 ring-sky-500/25",
  P5: "border-violet-500/55 bg-violet-950/65 text-violet-100 ring-violet-500/25",
  P6: "border-emerald-500/55 bg-emerald-950/65 text-emerald-100 ring-emerald-500/25",
};

const unknownStyles =
  "border-zinc-600 bg-zinc-900/80 text-zinc-200 ring-zinc-600/30";

export function PillarBadge({
  lineageLabel,
  pillar: pillarProp,
  className,
  ...rest
}: PillarBadgeProps) {
  const resolved =
    pillarProp ?? pillarFromLineageLabel(lineageLabel) ?? null;
  const styles = resolved ? pillarStyles[resolved] : unknownStyles;

  return (
    <span
      role="status"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset",
        styles,
        className
      )}
      title={lineageLabel}
      {...rest}
    >
      <span className="font-semibold tracking-tight">
        {resolved ?? "—"}
      </span>
      <span className="truncate font-normal opacity-90">{lineageLabel}</span>
    </span>
  );
}
