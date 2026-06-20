import { BrainPillarHealth } from "../components/BrainPillarHealth";
import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { DashboardModePanel } from "../components/DashboardModePanel";
import { DraftingHalSetupPanel } from "../components/DraftingHalSetupPanel";
import { useNarrative } from "../context/NarrativeContext";

export default function DraftingPage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <CreativePageHeader
        title="Drafting"
        description="Link a Google Doc, write there with HAL — velocity and sessions appear below"
      />
      {selection ? (
        <CreativeManuscriptShell>
          <DraftingHalSetupPanel manuscriptId={selection.manuscriptId} />
          <BrainPillarHealth pollIntervalMs={20_000} lookbackHours={168} />
          <DashboardModePanel
            manuscriptId={selection.manuscriptId}
            tenantId={selection.tenantId}
            mode="DRAFTING"
          />
        </CreativeManuscriptShell>
      ) : null}
    </div>
  );
}
