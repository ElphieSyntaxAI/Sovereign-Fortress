import { useEffect, useState } from "react";
import { PillarStatusGrid as PillarStatusGridUi, type PillarHealthReport } from "@elphie-syntax/ui";

import { fetchPillarHealth } from "../lib/msgf-admin-api";

type Props = {
  /** Optional author scope; omit for global ops view. */
  userId?: string;
};

export function PillarStatusGrid({ userId }: Props) {
  const [report, setReport] = useState<PillarHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchPillarHealth(userId ? { userId } : undefined)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load pillar health.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-2">
      {report?.scope.dashboard_view === "team_overview" ? (
        <p className="text-xs text-zinc-500">
          Team overview — pillar telemetry aggregates authors in your company scope.
        </p>
      ) : report?.scope.dashboard_view === "tenant_health" ? (
        <p className="text-xs text-zinc-500">
          Tenant health overview — cross-tenant stoplights for global operators.
        </p>
      ) : null}
      <PillarStatusGridUi
        report={report}
        loading={loading}
        error={error}
        globalScope={report ? report.scope.global : !userId}
      />
    </div>
  );
}
