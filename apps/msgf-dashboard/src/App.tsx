import { useCallback, useState } from "react";

import { ArbitrateIncidents } from "./components/ArbitrateIncidents";
import { BrainPushQueue } from "./components/BrainPushQueue";
import { CompanyLogicDeltaInbox } from "./components/CompanyLogicDeltaInbox";
import { GlobalInsightFeed } from "./components/GlobalInsightFeed";
import { GlobalLawBookPanel, LocalLawBookPanel } from "./components/LawBookPanels";
import { MultiTenantStatusBar } from "./components/MultiTenantStatusBar";
import { PillarStatusGrid } from "./components/PillarStatusGrid";
import { ProposedBrainUpdatesFeed } from "./components/ProposedBrainUpdatesFeed";
import { ValidatedLogicDeltasPanel } from "./components/ValidatedLogicDeltasPanel";
import type { AdminDashboardSession } from "./lib/msgf-admin-api";

export default function App() {
  const [dashSession, setDashSession] = useState<AdminDashboardSession | null>(null);

  const onDashboardSession = useCallback((s: AdminDashboardSession) => {
    setDashSession(s);
  }, []);

  const overviewTitle =
    dashSession?.dashboard_view === "team_overview"
      ? "Team overview"
      : "Global Brain / tenant health";

  const isGlobalOpsDashboard = dashSession?.dashboard_view === "tenant_health";
  const isTeamOverview = dashSession?.dashboard_view === "team_overview";
  const hideRawKeystrokes = dashSession?.dashboard_view !== "team_overview";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <MultiTenantStatusBar />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">MSGF operations dashboard</h1>
          <p className="mt-1 text-sm font-medium text-zinc-300">{overviewTitle}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {isGlobalOpsDashboard
              ? "Global queue: arbitration without raw dev keystrokes; validated logic deltas; proposed Brain updates (logic patterns only)."
              : "Live ARBITRATE queue and company validation — scoped by operator role."}
          </p>
        </div>

        <PillarStatusGrid />
        <ArbitrateIncidents onSession={onDashboardSession} hideDeveloperKeystrokes={hideRawKeystrokes} />
        {isGlobalOpsDashboard ? (
          <>
            <GlobalInsightFeed session={dashSession} />
            <GlobalLawBookPanel />
            <ValidatedLogicDeltasPanel />
            <ProposedBrainUpdatesFeed />
          </>
        ) : null}
        {isTeamOverview ? (
          <>
            <LocalLawBookPanel />
            <CompanyLogicDeltaInbox />
            <BrainPushQueue />
          </>
        ) : null}
      </main>
    </div>
  );
}
