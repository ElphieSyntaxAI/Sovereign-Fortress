"use client";

import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";
import { LogicDriftSparkline } from "./LogicDriftSparkline";
import {
  formatPredictiveTooltip,
  mapPillarStatusToStoplightTone,
  PILLAR_ORDER,
  stoplightTitle,
  type PillarHealthEntry,
  type PillarHealthReport,
  type StoplightTone,
} from "../lib/pillarHealth";

export type PillarStatusGridProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  report: PillarHealthReport | null;
  loading?: boolean;
  error?: string | null;
  /** Shown when scope is global (ops dashboard). */
  globalScope?: boolean;
};

const TONE_STYLES: Record<
  StoplightTone,
  { ring: string; glow: string; label: string }
> = {
  green: {
    ring: "bg-emerald-400",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.55)]",
    label: "Stable",
  },
  yellow: {
    ring: "bg-amber-400",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.5)]",
    label: "Self-Healing",
  },
  red: {
    ring: "bg-red-500",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.55)]",
    label: "Manual ARBITRATE",
  },
  predictive: {
    ring: "bg-violet-400",
    glow: "shadow-[0_0_14px_rgba(167,139,250,0.55)]",
    label: "Predictive",
  },
};

function stoplightCaption(entry: PillarHealthEntry): string {
  if (entry.status === "yellow_self_healing") return "Self-Healing";
  if (entry.status === "yellow") return "Caution";
  if (entry.status === "red") return "ARBITRATE";
  if (entry.status === "predicted") return "Predictive";
  return "Stable";
}

function StoplightIcon({
  tone,
  title,
  caption,
  predictiveBadge,
}: {
  tone: StoplightTone;
  title: string;
  caption: string;
  predictiveBadge?: string;
}) {
  const style = TONE_STYLES[tone];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "relative block h-4 w-4 rounded-full ring-2 ring-zinc-950/80",
          style.ring,
          style.glow
        )}
        title={title}
        role="img"
        aria-label={title}
      />
      {predictiveBadge ? (
        <span
          className="max-w-[5.5rem] cursor-help text-center text-[9px] font-medium leading-tight text-violet-300/90 underline decoration-dotted decoration-violet-500/60 underline-offset-2"
          title={predictiveBadge}
        >
          Predictive
        </span>
      ) : (
        <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">
          {caption}
        </span>
      )}
    </div>
  );
}

function statusHeadline(entry: PillarHealthEntry): string {
  if (entry.status === "yellow_self_healing") return "Auto-correcting";
  if (entry.status === "red") return "Intervention";
  if (entry.status === "predicted") return "Watch";
  if (entry.status === "yellow") return "Caution";
  return "Stable";
}

function PillarCard({
  entry,
  predictiveTooltip,
  showPredictiveBadge,
}: {
  entry: PillarHealthEntry;
  predictiveTooltip: string;
  showPredictiveBadge: boolean;
}) {
  const tone = mapPillarStatusToStoplightTone(entry.status);
  const title = stoplightTitle(entry, predictiveTooltip);
  const predictiveOnCard =
    showPredictiveBadge &&
    (entry.status === "predicted" || entry.predicted_future_issue);

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/80 px-3 py-3",
        entry.status === "red" && "border-red-900/50 bg-red-950/20",
        entry.status === "predicted" && "border-violet-900/40 bg-violet-950/15"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold text-violet-300">{entry.pillar}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{entry.label}</p>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {statusHeadline(entry)}
        </span>
      </div>

      <div className="flex justify-center py-1">
        <StoplightIcon
          tone={tone}
          title={title}
          caption={stoplightCaption(entry)}
          predictiveBadge={predictiveOnCard ? predictiveTooltip : undefined}
        />
      </div>

      <p className="text-center text-[10px] leading-relaxed text-zinc-500">{entry.summary}</p>
    </li>
  );
}

export function PillarStatusGrid({
  report,
  loading,
  error,
  globalScope,
  className,
  ...rest
}: PillarStatusGridProps) {
  const predictiveTooltip = report
    ? formatPredictiveTooltip(report.logic_drift)
    : formatPredictiveTooltip({
        predicted_stability_pct: 94,
        predictive_pulse_horizon: 50,
        trend: "stable",
        slope: 0,
        sample_count: 0,
        last_scores: [],
        predicted_future_issue: false,
        escalation_threshold: 0.3,
      });

  const globalPredictive =
    report?.logic_drift.predicted_future_issue === true ||
    report?.overall_status === "predicted";

  const ordered =
    report?.pillars.slice().sort(
      (a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar)
    ) ?? [];

  return (
    <section
      className={cn("space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4", className)}
      {...rest}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Brain pillar stoplight</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {globalScope
              ? "Global ops view — six governance pillars (P1–P6)."
              : "Your MSGF Brain pillars — updates on a live cadence while this page is open."}
          </p>
        </div>
        {report ? (
          <span
            className="cursor-help text-[10px] text-violet-300/90 underline decoration-dotted decoration-violet-500/50 underline-offset-2"
            title={predictiveTooltip}
          >
            Predictive
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading pillar health…</p>
      ) : null}
      {error ? <p className="text-xs text-amber-400/90">{error}</p> : null}

      {!loading && !error && report ? (
        <>
          <LogicDriftSparkline logicDrift={report.logic_drift} className="rounded-md border border-zinc-800/80 bg-zinc-950/50 p-2.5" />
          {globalPredictive ? (
            <p
              className="rounded-md border border-violet-800/40 bg-violet-950/30 px-2.5 py-2 text-[11px] text-violet-200/90"
              title={predictiveTooltip}
            >
              {predictiveTooltip}
            </p>
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((entry) => (
              <PillarCard
                key={entry.pillar}
                entry={entry}
                predictiveTooltip={predictiveTooltip}
                showPredictiveBadge={globalPredictive}
              />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
