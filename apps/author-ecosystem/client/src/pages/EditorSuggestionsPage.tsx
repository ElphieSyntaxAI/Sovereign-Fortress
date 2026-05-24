import { EditorRequestButton } from "../components/EditorRequestButton";
import { CreativeManuscriptShell } from "../components/CreativeManuscriptShell";
import { CreativePageHeader } from "../components/CreativePageHeader";
import { DashboardModePanel } from "../components/DashboardModePanel";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { useNarrative } from "../context/NarrativeContext";
import { useCallback } from "react";

export default function EditorSuggestionsPage() {
  const { selection } = useNarrative();
  const getToken = useCallback(() => getPreferredBffBearer(), []);

  return (
    <div className="space-y-6">
      <CreativePageHeader
        title="Editor suggestions"
        description="Request verified editors and review helper-proof milestones for"
      />
      {selection ? (
        <CreativeManuscriptShell>
          <section className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4">
            <h2 className="text-sm font-semibold text-violet-100">Editor hub</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Unlocks after revision passes meet continuity thresholds. Tooltips explain remaining requirements.
            </p>
            <div className="mt-3">
              <EditorRequestButton manuscriptId={selection.manuscriptId} getAccessToken={getToken} />
            </div>
          </section>
          <DashboardModePanel
            manuscriptId={selection.manuscriptId}
            tenantId={selection.tenantId}
            mode="PLANNING"
          />
        </CreativeManuscriptShell>
      ) : null}
    </div>
  );
}
