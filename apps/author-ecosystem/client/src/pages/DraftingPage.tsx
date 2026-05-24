import HALTracker from "../components/HALTracker.jsx";
import { BrainPillarHealth } from "../components/BrainPillarHealth";
import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { DashboardModePanel } from "../components/DashboardModePanel";
import { useNarrative } from "../context/NarrativeContext";

export default function DraftingPage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <CreativePageHeader
        title="Drafting"
        description="HAL glass box, velocity, and live sessions for"
      />
      {selection ? (
        <CreativeManuscriptShell>
          <BrainPillarHealth pollIntervalMs={20_000} lookbackHours={168} />
          <DashboardModePanel
            manuscriptId={selection.manuscriptId}
            tenantId={selection.tenantId}
            mode="DRAFTING"
          />
          <HALTracker />
        </CreativeManuscriptShell>
      ) : null}
    </div>
  );
}
