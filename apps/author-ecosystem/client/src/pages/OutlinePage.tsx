import { PlanningCommandCenter } from "../components/PlanningCommandCenter";
import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { useNarrative } from "../context/NarrativeContext";

export default function OutlinePage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <CreativePageHeader
        title="Outline"
        description="Bible, plot chunks, and beat sandbox for"
      />
      {selection ? (
        <CreativeManuscriptShell>
          <PlanningCommandCenter
            manuscriptId={selection.manuscriptId}
            tenantId={selection.tenantId}
            initialTab="wiki"
            allowedTabs={["wiki", "sandbox", "interview"]}
            compactChrome
          />
        </CreativeManuscriptShell>
      ) : null}
    </div>
  );
}
