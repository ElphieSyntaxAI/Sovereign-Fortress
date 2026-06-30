import { useState } from "react";

import { AuthorTagInput } from "./planningBlockUi";
import { EntityFocusPanel } from "./world/EntityFocusPanel";
import { LocationScopeTree } from "./world/LocationScopeTree";
import { EcologyStackPanel } from "./world/ScopedEnvironmentStack";
import { StoryScopeGuardrail } from "./world/StoryScopeGuardrail";
import { UniversalLedgerPanel } from "./world/UniversalLedgerPanel";
import { useWorldBuildState } from "../hooks/useWorldBuildState";
import {
  importWorldFromWiki,
  pushStackEntryToWiki,
  upsertStackEntryToPlotPool,
} from "../lib/planningBlockSync";
import type { CivilizationStackLayer, LocationKind } from "../lib/worldBuildTypes";
import { isEcologyLocationKind, isFocusableLocationKind } from "../lib/worldBuildTypes";

export type WorldBuildingPanelProps = {
  manuscriptId: string;
};

export function WorldBuildingPanel({ manuscriptId }: WorldBuildingPanelProps) {
  const wb = useWorldBuildState(manuscriptId);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roots = wb.state.storyScope ? wb.getChildren(null) : [];
  const showEcology =
    wb.activeLocation && isEcologyLocationKind(wb.activeLocation.kind);
  const showFocusPrompt =
    wb.activeLocation && isFocusableLocationKind(wb.activeLocation.kind);

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

  const saveFocusEntryToWiki = async () => {
    const entry = wb.selectedEntry;
    const loc = wb.focusContextLocation;
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

  const saveEnvironmentEntryToWiki = async () => {
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

  const addStackEntryForContext = (
    locationId: string,
    layer: CivilizationStackLayer
  ) => {
    wb.addStackEntry(locationId, layer);
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

          <div
            className={[
              "flex min-h-[24rem] flex-col gap-4 lg:flex-row",
              wb.isFocusDrawerOpen ? "lg:gap-0" : "",
            ].join(" ")}
          >
            <aside className="w-full shrink-0 border-b border-zinc-800 pb-4 lg:w-1/4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-3">
              <LocationScopeTree
                scope={wb.state.storyScope}
                roots={roots}
                activeLocationId={wb.state.activeLocationId}
                focusContextId={wb.state.activeEntityContext}
                getChildren={wb.getChildren}
                getChildKinds={wb.getChildKindsFor}
                onSelect={wb.setActiveLocation}
                onAddRootSibling={() => wb.addRootLocation()}
                onAddChild={handleAddChild}
                onAddSibling={(parentId, kind) => wb.addLocation(parentId, kind)}
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

            <main
              className={[
                "min-w-0 flex-1 border-b border-zinc-800 pb-4 lg:border-b-0 lg:pb-0",
                wb.isFocusDrawerOpen ? "lg:w-[33%] lg:border-r lg:pr-3" : "",
              ].join(" ")}
            >
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

                  {showFocusPrompt ? (
                    <p className="rounded border border-violet-800/40 bg-violet-950/20 px-3 py-2 text-xs text-violet-200">
                      Society & culture layers open in the focus panel on the right. Ecology
                      (environment, fauna, flora) stays here in the center.
                    </p>
                  ) : null}

                  {showEcology ? (
                    <>
                      <EcologyStackPanel
                        locationKind={wb.activeLocation.kind}
                        locationTitle={wb.activeLocation.title}
                        entries={wb.entriesForActiveLocation}
                        selectedId={wb.state.selectionId}
                        manuscriptId={manuscriptId}
                        onAddEntry={(layer) =>
                          addStackEntryForContext(wb.state.activeLocationId!, layer)
                        }
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
                          onClick={() => void saveEnvironmentEntryToWiki()}
                          className="rounded border border-emerald-600/50 bg-emerald-950/40 px-3 py-1 text-xs text-emerald-100 disabled:opacity-40"
                        >
                          Save selected to wiki
                        </button>
                      </div>
                    </>
                  ) : !showFocusPrompt ? (
                    <p className="text-xs italic text-zinc-500">
                      Select a location in the tree — ecology layers appear for planets and
                      systems; continent / city nodes open the cultural focus panel.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs italic text-zinc-500">
                  Select a location in the tree to begin building your world.
                </p>
              )}
            </main>

            {wb.isFocusDrawerOpen && wb.focusContextLocation ? (
              <EntityFocusPanel
                location={wb.focusContextLocation}
                breadcrumb={wb.focusBreadcrumb}
                entries={wb.entriesForFocusContext}
                selectedId={wb.state.selectionId}
                manuscriptId={manuscriptId}
                busy={busy}
                onClose={wb.clearEntityContext}
                onAddEntry={(layer) =>
                  addStackEntryForContext(wb.state.activeEntityContext!, layer)
                }
                onSelect={wb.setSelectionId}
                onDelete={wb.deleteStackEntry}
                onPatch={wb.patchStackEntry}
                onFieldChange={handleStackFieldChange}
                onModeChange={wb.setEntryMode}
                onSaveToWiki={() => void saveFocusEntryToWiki()}
                onAddToPlotPool={() => {
                  const entry = wb.selectedEntry;
                  const loc = wb.focusContextLocation;
                  if (!entry || !loc) return;
                  upsertStackEntryToPlotPool(manuscriptId, entry, loc.title);
                  setStatus(`"${entry.title}" added to plot environmental pool.`);
                }}
              />
            ) : null}
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
