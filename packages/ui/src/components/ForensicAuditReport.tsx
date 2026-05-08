"use client";

import type { HTMLAttributes } from "react";
import { useMemo, useState } from "react";

import { cn } from "../lib/cn";
import {
  UniversalCalibrationUI,
  type UniversalCalibrationRole,
} from "./UniversalCalibrationUI";

const DRIFT_THRESHOLD_DAYS = 30;
const QUICK_RESYNC_MS = 2 * 60 * 1000;

export type ForensicAuditReportProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** ISO string or Date from the last forensic / HAL session. */
  lastSessionAt?: string | Date | null;
  role: UniversalCalibrationRole;
  /** Called when the quick re-sync calibration finishes (timer or early complete). */
  onQuickResyncEnd?: (payload: { content: string; keystrokeLatenciesMs: number[] }) => void;
};

function calendarDaysSince(last: Date): number {
  const ms = Date.now() - last.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function ForensicAuditReport({
  lastSessionAt,
  role,
  className,
  onQuickResyncEnd,
  ...rest
}: ForensicAuditReportProps) {
  const [quickSyncOpen, setQuickSyncOpen] = useState(false);

  const showLinguisticDecayWarning = useMemo(() => {
    if (lastSessionAt == null || lastSessionAt === "") return false;
    const d = typeof lastSessionAt === "string" ? new Date(lastSessionAt) : lastSessionAt;
    if (Number.isNaN(d.getTime())) return false;
    return calendarDaysSince(d) > DRIFT_THRESHOLD_DAYS;
  }, [lastSessionAt]);

  const isAuthor = role === "author";

  const shell = isAuthor
    ? "border-amber-700/50 bg-amber-950/25"
    : "border-amber-600/40 bg-amber-950/20";

  const title = isAuthor ? "text-amber-100" : "text-amber-50";
  const body = isAuthor ? "text-amber-200/90" : "text-amber-100/85";
  const btn =
    "rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-amber-400/40 " +
    (isAuthor
      ? "bg-amber-600 text-zinc-950 hover:bg-amber-500"
      : "bg-amber-500 text-zinc-950 hover:bg-amber-400");

  return (
    <div className={cn("relative", className)} {...rest}>
      {showLinguisticDecayWarning && (
        <div
          className={cn("rounded-xl border p-4 shadow-lg sm:p-5", shell)}
          role="region"
          aria-label="Linguistic decay warning"
        >
          <h3 className={cn("text-base font-semibold tracking-tight", title)}>
            Linguistic Decay Warning
          </h3>
          <p className={cn("mt-2 text-sm leading-relaxed", body)}>
            It has been over 30 days since your last session. Your current identity confidence may be
            lower until a re-sync occurs.
          </p>
          <button type="button" className={cn("mt-4", btn)} onClick={() => setQuickSyncOpen(true)}>
            Quick Re-sync
          </button>
        </div>
      )}

      {quickSyncOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forensic-quick-resync-title"
        >
          <div className="relative max-h-[min(92vh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700/80 bg-zinc-950 p-4 shadow-2xl sm:p-6">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => setQuickSyncOpen(false)}
              aria-label="Close quick re-sync"
            >
              Close
            </button>
            <h2
              id="forensic-quick-resync-title"
              className="mb-4 pr-16 text-lg font-semibold text-zinc-100"
            >
              Quick Re-sync
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Two-minute session to refresh keystroke and text timing signals for your audit trail.
            </p>
            <UniversalCalibrationUI
              role={role}
              sessionDurationMs={QUICK_RESYNC_MS}
              onSessionEnd={(payload) => {
                onQuickResyncEnd?.(payload);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
