import { PillarStatusGrid, type PillarHealthReport } from "@elphie-syntax/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

export type BrainPillarHealthProps = {
  /** Poll interval while the dashboard tab is visible (default ~22s). */
  pollIntervalMs?: number;
  /** Passed to MSGF HealthService (default 168h). */
  lookbackHours?: number;
  className?: string;
};

export function BrainPillarHealth({
  pollIntervalMs = 22_000,
  lookbackHours = 168,
  className,
}: BrainPillarHealthProps) {
  const [report, setReport] = useState<PillarHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState<string | null>(null);
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    setError(null);
    if (firstLoadRef.current) setLoading(true);
    try {
      const token = await getPreferredBffBearer();
      const qs = new URLSearchParams();
      qs.set("lookback_hours", String(lookbackHours));
      const res = await fetch(bffUrl(`/api/msgf/health/pillars?${qs.toString()}`), {
        ...bffCredentials,
        headers: bffAuthHeaders(token),
      });
      const data = (await res.json()) as PillarHealthReport & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Pillar health failed (${res.status})`);
      }
      setReport(data);
      setLastOkAt(new Date().toISOString());
      firstLoadRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Brain pillar health.");
    } finally {
      setLoading(false);
    }
  }, [lookbackHours]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
    }, pollIntervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, pollIntervalMs]);

  const liveLabel = lastOkAt
    ? `Live · last sync ${new Date(lastOkAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : null;

  return (
    <div className={className}>
      {liveLabel ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400/90">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {liveLabel}
          </span>
        </p>
      ) : null}
      <PillarStatusGrid report={report} loading={loading} error={error} globalScope={false} />
    </div>
  );
}
