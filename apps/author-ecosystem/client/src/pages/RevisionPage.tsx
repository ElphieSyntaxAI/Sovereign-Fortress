import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { DashboardModePanel } from "../components/DashboardModePanel";
import { useNarrative } from "../context/NarrativeContext";

export default function RevisionPage() {
  const { selection } = useNarrative();

  return (
    <div className="space-y-6">
      <CreativePageHeader
        title="Revision passes"
        description="Revision cooldown, dual Librarian + Critic review, and consistency checks for"
      />
      {selection ? (
        <CreativeManuscriptShell useRevisionLock>
          <DashboardModePanel
            manuscriptId={selection.manuscriptId}
            tenantId={selection.tenantId}
            mode="REVISION"
          />
        </CreativeManuscriptShell>
      ) : null}
    </div>
  );
}
