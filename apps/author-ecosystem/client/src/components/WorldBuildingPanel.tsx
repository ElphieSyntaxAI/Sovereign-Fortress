import { useState } from "react";

import { AuthorTagInput } from "./planningBlockUi";
import { CivilizationStack } from "./world/CivilizationStack";
import { LocationScopeTree } from "./world/LocationScopeTree";
import { StoryScopeGuardrail } from "./world/StoryScopeGuardrail";
import { UniversalLedgerPanel } from "./world/UniversalLedgerPanel";
import { useWorldBuildState } from "../hooks/useWorldBuildState";
import {
  importWorldFromWiki,
  pushStackEntryToWiki,
  upsertStackEntryToPlotPool,
} from "../lib/planningBlockSync";
import type { CivilizationStackLayer, LocationKind } from "../lib/worldBuildTypes";

export type WorldBuildingPanelProps = {
  manuscriptId: string;
};

export function WorldBuildingPanel({ manuscriptId }: WorldBuildingPanelProps) {
  const wb = useWorldBuildState(manuscriptId);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roots = wb.state.storyScope ? wb.getChildren(null) : [];

  const refreshFromWiki = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const n = await importWorldFromWiki(manuscriptId);
      setStatus(n ? `Imported ${n} world entries from wiki.` : "No new world bible entries found.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveSelectedToWiki = async () => {
    const entry = wb.selectedEntry;
    const loc = wb.activeLocation;
    if (!entry || !loc) return;
    setBusy(true);
    setStatus(null);
    try {
      const ref = await pushStackEntryToWiki(manuscriptId, entry, loc, wb.state);
      wb.patchStackEntry(entry.id, { wikiRef: ref });
      setStatus(`Saved "${entry.title}" to wiki.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleStackFieldChange = (entryId: string, key: string, value: string) => {
    const entry = wb.state.stackEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const next = { ...(entry.outlineFields ?? {}), [key]: value };
    if (!value.trim() && key !== "containsSpoiler") delete next[key];
    wb.patchStackEntry(entryId, { outlineFields: next });
  };

  const handleAddChild = (parentId: string, kind: LocationKind) => {
    wb.addLocation(parentId, kind);
  };

  return (
    <div className="flex min-h-[32rem] flex-col gap-4 overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0612] p-4">
      <StoryScopeGuardrail
        value={wb.state.storyScope}
        onChange={(scope) => wb.setStoryScope(scope)}
      />

      {wb.state.storyScope ? (
        <>
          <UniversalLedgerPanel
            storyScope={wb.state.storyScope}
            fields={wb.state.universalLedger ?? {}}
            onFieldChange={wb.setUniversalLedgerField}
          />

          <div className="flex min-h-[24rem] flex-col gap-4 lg:flex-row">
            <aside className="w-full shrink-0 border-b border-zinc-800 pb-4 lg:w-1/4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3">
              <LocationScopeTree
                scope={wb.state.storyScope}
                roots={roots}
                activeLocationId={wb.state.activeLocationId}
                getChildren={wb.getChildren}
                getChildKinds={wb.getChildKindsFor}
                onSelect={wb.setActiveLocation}
                onAddRootSibling={() => wb.addRootLocation()}
                onAddChild={handleAddChild}
                onDelete={wb.deleteLocation}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshFromWiki()}
                className="mt-3 w-full rounded border border-zinc-700 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                Refresh from wiki
              </button>
            </aside>

            <main className="min-w-0 flex-1">
              {status ? <p className="mb-3 text-xs text-zinc-400">{status}</p> : null}

              {wb.activeLocation ? (
                <div className="space-y-4">
                  <div>
                    <input
                      value={wb.activeLocation.title}
                      onChange={(e) =>
                        wb.patchLocation(wb.activeLocation!.id, { title: e.target.value })
                      }
                      className="mb-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                    />
                    {wb.breadcrumb ? (
                      <p className="text-[10px] text-zinc-500">{wb.breadcrumb}</p>
                    ) : null}
                  </div>

                  <AuthorTagInput
                    tags={wb.activeLocation.authorTags ?? []}
                    onChange={(authorTags) =>
                      wb.patchLocation(wb.activeLocation!.id, { authorTags })
                    }
                  />

                  <CivilizationStack
                    locationTitle={wb.activeLocation.title}
                    entries={wb.entriesForActiveLocation}
                    selectedId={wb.state.selectionId}
                    manuscriptId={manuscriptId}
                    onAddEntry={(layer: CivilizationStackLayer) => {
                      if (wb.state.activeLocationId) {
                        wb.addStackEntry(wb.state.activeLocationId, layer);
                      }
                    }}
                    onSelect={wb.setSelectionId}
                    onDelete={wb.deleteStackEntry}
                    onPatch={wb.patchStackEntry}
                    onFieldChange={handleStackFieldChange}
                    onModeChange={wb.setEntryMode}
                  />

                  <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
                    <button
                      type="button"
                      disabled={busy || !wb.selectedEntry}
                      onClick={() => void saveSelectedToWiki()}
                      className="rounded border border-emerald-600/50 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-100 disabled:opacity-40"
                    >
                      Save selected to wiki
                    </button>
                    <button
                      type="button"
                      disabled={!wb.selectedEntry || !wb.activeLocation}
                      onClick={() => {
                        if (!wb.selectedEntry || !wb.activeLocation) return;
                        upsertStackEntryToPlotPool(
                          manuscriptId,
                          wb.selectedEntry,
                          wb.activeLocation.title
                        );
                        setStatus(`"${wb.selectedEntry.title}" added to plot environmental pool.`);
                      }}
                      className="rounded border border-violet-600/50 px-3 py-1 text-xs text-violet-200 disabled:opacity-40"
                    >
                      Add selected to plot pools
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-zinc-500">
                  Select a location in the tree to build its civilization stack.
                </p>
              )}
            </main>
          </div>
        </>
      ) : (
        <p className="text-xs italic text-zinc-500">
          Choose a story scope above to begin building your world.
        </p>
      )}
    </div>
  );
}
