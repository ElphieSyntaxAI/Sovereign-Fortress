"use client";

import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";
import type { LogicDriftTrendReport } from "../lib/pillarHealth";

export type LogicDriftSparklineProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  logicDrift: LogicDriftTrendReport;
};

/**
 * Minimal sparkline of recent pulse / drift samples (tenant-visible trajectory).
 */
export function LogicDriftSparkline({
  logicDrift,
  className,
  ...rest
}: LogicDriftSparklineProps) {
  const scores = logicDrift.last_scores?.filter((n) => typeof n === "number" && Number.isFinite(n)) ?? [];
  if (scores.length < 2) {
    return (
      <div
        className={cn("rounded-md border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-2", className)}
        {...rest}
      >
        <p className="text-[10px] text-zinc-500">
          Logic drift trend will appear after more pulses in this window.
        </p>
      </div>
    );
  }

  const w = 280;
  const h = 48;
  const pad = 4;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = Math.max(max - min, 1e-6);

  const pts = scores.map((v, i) => {
    const x = pad + (i / Math.max(scores.length - 1, 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const trendLabel =
    logicDrift.trend === "increasing"
      ? "Trend: rising"
      : logicDrift.trend === "decreasing"
        ? "Trend: easing"
        : "Trend: stable";

  return (
    <div className={cn("space-y-1.5", className)} {...rest}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span className="font-medium text-zinc-400">Logic drift (recent samples)</span>
        <span title={`Samples: ${logicDrift.sample_count}`}>
          {trendLabel} · n={scores.length}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-md text-emerald-400/90"
        role="img"
        aria-label={`Logic drift sparkline, ${scores.length} samples, ${logicDrift.trend} trend`}
      >
        <title>Logic drift trajectory</title>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts.join(" ")}
        />
      </svg>
    </div>
  );
}
