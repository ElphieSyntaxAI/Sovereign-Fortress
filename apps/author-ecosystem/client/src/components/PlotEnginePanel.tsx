import { useCallback, useEffect, useMemo, useState } from "react";

import { hydratePlotEngineFromIngest } from "../lib/plotEngineHydrate";
import { flattenPlotEngineToBeats } from "../lib/plotEngineSerialize";
import { loadPlotEngineState, savePlotEngineState } from "../lib/plotEngineStorage";
import {
  defaultEraForPlotIndex,
  defaultSpoilerLevelForPlotIndex,
} from "../lib/plotEngineRagOutlineSchema";
import {
  BlockInputModeToggle,
  OutlineRagPanel,
  sceneInputMode,
  TokenPool,
} from "./planningBlockUi";
import {
  createId,
  createPlotPoint,
  createScene,
  defaultPlotEngineState,
  reindexPlotPoints,
  PANEL_LABELS,
  seedPlotPoints,
  SHELF_PANELS,
  SIDEBAR_PANELS,
  type BlockInputMode,
  type GlobalToken,
  type OutlineRagFields,
  type PanelKey,
  type PlotEngineState,
  type PlotPoint,
  type PlotTemplateId,
  toSyncPayload,
} from "../lib/plotEngineTypes";
import { usePlanningSession } from "../planning/PlanningSessionContext";
import { DOCUMENT_INGEST_COMMITTED_EVENT, type DocumentIngestCommittedDetail } from "../lib/documentIngestEvents";
import { bootstrapPlotEngineFromWiki } from "../lib/plotEngineBootstrap";
import { getPreferredBffBearer } from "../lib/authAccessToken";

export type PlotEnginePanelProps = {
  manuscriptId: string;
};

function findPlot(state: PlotEngineState, plotId: string): PlotPoint | undefined {
  return state.plotPoints.find((p) => p.id === plotId);
}

function findScene(state: PlotEngineState, plotId: string, sceneId: string) {
  const plot = findPlot(state, plotId);
  return plot?.scenes.find((s) => s.id === sceneId);
}

export function PlotEnginePanel({ manuscriptId }: PlotEnginePanelProps) {
  const { setPlotBeats, reloadPlotBeatsFromStorage } = usePlanningSession();
  const [state, setState] = useState<PlotEngineState>(() =>
    manuscriptId ? loadPlotEngineState(manuscriptId) ?? defaultPlotEngineState("custom") : defaultPlotEngineState()
  );

  const persist = useCallback(
    (next: PlotEngineState) => {
      setState(next);
      if (manuscriptId) savePlotEngineState(manuscriptId, next);
      setPlotBeats(flattenPlotEngineToBeats(next));
    },
    [manuscriptId, setPlotBeats]
  );

  useEffect(() => {
    if (!manuscriptId) return;
    const loaded = loadPlotEngineState(manuscriptId) ?? defaultPlotEngineState("custom");
    setState(loaded);
    setPlotBeats(flattenPlotEngineToBeats(loaded));
    void bootstrapPlotEngineFromWiki(manuscriptId, () => getPreferredBffBearer()).then((did) => {
      if (!did) return;
      const next = loadPlotEngineState(manuscriptId) ?? loaded;
      setState(next);
      setPlotBeats(flattenPlotEngineToBeats(next));
    });
  }, [manuscriptId, setPlotBeats]);

  useEffect(() => {
    const onIngest = (ev: Event) => {
      const detail = (ev as CustomEvent<DocumentIngestCommittedDetail>).detail;
      if (detail?.manuscriptId !== manuscriptId) return;
      if (detail.proposedWiki?.length || detail.outlineBeats?.length) {
        const next = applyFileImportToPlotEngine(
          manuscriptId,
          detail.proposedWiki ?? [],
          detail.outlineBeats ?? []
        );
        setState(next);
        setPlotBeats(flattenPlotEngineToBeats(next));
      } else {
        void bootstrapPlotEngineFromWiki(manuscriptId, () => getPreferredBffBearer(), { force: true }).then(
          (did) => {
            if (!did) {
              reloadPlotBeatsFromStorage();
              return;
            }
            const next = loadPlotEngineState(manuscriptId);
            if (next) {
              setState(next);
              setPlotBeats(flattenPlotEngineToBeats(next));
            }
          }
        );
      }
    };
    window.addEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
    return () => window.removeEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
  }, [manuscriptId, reloadPlotBeatsFromStorage, setPlotBeats]);

  const sortedPlots = useMemo(
    () => reindexPlotPoints(state.plotPoints),
    [state.plotPoints]
  );

  const selectedScene =
    state.selection.plotPointId && state.selection.sceneId
      ? findScene(state, state.selection.plotPointId, state.selection.sceneId)
      : undefined;
  const selectedPlot = state.selection.plotPointId
    ? findPlot(state, state.selection.plotPointId)
    : undefined;
  const selectedPlotIndex = selectedPlot
    ? sortedPlots.findIndex((p) => p.id === selectedPlot.id)
    : -1;
  const panelsActive = Boolean(selectedScene);
  const outlineMode = selectedScene ? sceneInputMode(selectedScene) === "outline" : false;

  const patchSelectedScene = (patch: Partial<typeof selectedScene>) => {
    if (!selectedScene || !state.selection.plotPointId) return;
    const plotId = state.selection.plotPointId;
    const sceneId = selectedScene.id;
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) =>
        p.id !== plotId
          ? p
          : {
              ...p,
              scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
            }
      ),
    });
  };

  const seedOutlineDefaults = (scene: NonNullable<typeof selectedScene>): OutlineRagFields => {
    const existing = scene.outlineRagFields ?? {};
    const plotIdx = Math.max(selectedPlotIndex, 0);
    const total = Math.max(sortedPlots.length, 1);
    const plotTitle = selectedPlot?.title?.trim() ?? "";
    const spoilerFields = { ...(existing.spoilerLevel ?? {}) };
    if (!spoilerFields.plotPoint && plotTitle) spoilerFields.plotPoint = plotTitle;
    if (!spoilerFields.spoilerLevel) {
      spoilerFields.spoilerLevel = defaultSpoilerLevelForPlotIndex(plotIdx, total);
    }
    if (!spoilerFields.era) {
      spoilerFields.era = defaultEraForPlotIndex(plotIdx, total);
    }
    return { ...existing, spoilerLevel: spoilerFields };
  };

  const setBlockInputMode = (mode: BlockInputMode) => {
    if (!selectedScene) return;
    const patch: Partial<typeof selectedScene> = { blockInputMode: mode };
    if (mode === "outline") {
      patch.outlineRagFields = seedOutlineDefaults(selectedScene);
    }
    patchSelectedScene(patch);
  };

  const updateOutlineRagField = (panel: PanelKey, key: string, value: string) => {
    if (!selectedScene) return;
    const current = selectedScene.outlineRagFields ?? {};
    const panelFields = { ...(current[panel] ?? {}), [key]: value };
    if (!value.trim() && key !== "containsSpoiler") {
      delete panelFields[key];
    }
    patchSelectedScene({
      outlineRagFields: { ...current, [panel]: panelFields },
    });
  };

  const changeTemplate = (templateId: PlotTemplateId) => {
    if (
      state.plotPoints.length > 0 &&
      !window.confirm("Switch template? This replaces current plot points.")
    ) {
      return;
    }
    persist({
      ...state,
      templateId,
      plotPoints: seedPlotPoints(templateId),
      selection: { plotPointId: null, sceneId: null },
    });
  };

  const addPlotPoint = () => {
    const sorted = reindexPlotPoints(state.plotPoints);
    const next = [...sorted, createPlotPoint("New plot event", sorted.length)];
    persist({
      ...state,
      plotPoints: reindexPlotPoints(next),
    });
  };

  const insertPlotPointAfter = (afterPlotId: string | null) => {
    const sorted = reindexPlotPoints(state.plotPoints);
    const insertAt =
      afterPlotId == null ? 0 : sorted.findIndex((p) => p.id === afterPlotId) + 1;
    if (afterPlotId != null && insertAt === 0) return;
    const newPoint = createPlotPoint("New plot event", insertAt);
    const next = [...sorted.slice(0, insertAt), newPoint, ...sorted.slice(insertAt)];
    persist({
      ...state,
      plotPoints: reindexPlotPoints(next),
      selection: { plotPointId: newPoint.id, sceneId: null },
    });
  };

  const movePlotPoint = (plotId: string, dir: -1 | 1) => {
    const sorted = reindexPlotPoints(state.plotPoints);
    const idx = sorted.findIndex((p) => p.id === plotId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    [sorted[idx], sorted[j]] = [sorted[j]!, sorted[idx]!];
    persist({ ...state, plotPoints: reindexPlotPoints(sorted) });
  };

  const deletePlotPoint = (plotId: string) => {
    persist({
      ...state,
      plotPoints: reindexPlotPoints(state.plotPoints.filter((p) => p.id !== plotId)),
      selection:
        state.selection.plotPointId === plotId
          ? { plotPointId: null, sceneId: null }
          : state.selection,
    });
  };

  const updatePlotTitle = (plotId: string, title: string) => {
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) => (p.id === plotId ? { ...p, title } : p)),
    });
  };

  const insertSceneAfter = (plotId: string, afterSceneId: string | null) => {
    let newSceneId: string | null = null;
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) => {
        if (p.id !== plotId) return p;
        const scenes = [...p.scenes].sort((a, b) => a.order - b.order);
        const insertAt =
          afterSceneId == null ? 0 : scenes.findIndex((s) => s.id === afterSceneId) + 1;
        if (afterSceneId != null && insertAt === 0) return p;
        const scene = createScene(`Scene ${insertAt + 1}`);
        newSceneId = scene.id;
        const next = [...scenes.slice(0, insertAt), scene, ...scenes.slice(insertAt)].map(
          (s, order) => ({ ...s, order })
        );
        return { ...p, scenes: next };
      }),
      selection: newSceneId
        ? { plotPointId: plotId, sceneId: newSceneId }
        : state.selection,
    });
  };

  const addScene = (plotId: string) => {
    const plot = state.plotPoints.find((p) => p.id === plotId);
    const scenes = plot ? [...plot.scenes].sort((a, b) => a.order - b.order) : [];
    insertSceneAfter(plotId, scenes[scenes.length - 1]?.id ?? null);
  };

  const deleteScene = (plotId: string, sceneId: string) => {
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) =>
        p.id === plotId ? { ...p, scenes: p.scenes.filter((s) => s.id !== sceneId) } : p
      ),
      selection:
        state.selection.sceneId === sceneId ? { plotPointId: plotId, sceneId: null } : state.selection,
    });
  };

  const moveScene = (plotId: string, sceneId: string, dir: -1 | 1) => {
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) => {
        if (p.id !== plotId) return p;
        const scenes = [...p.scenes].sort((a, b) => a.order - b.order);
        const idx = scenes.findIndex((s) => s.id === sceneId);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= scenes.length) return p;
        [scenes[idx], scenes[j]] = [scenes[j]!, scenes[idx]!];
        return { ...p, scenes: scenes.map((s, order) => ({ ...s, order })) };
      }),
    });
  };

  const selectPlot = (plotId: string) => {
    persist({ ...state, selection: { plotPointId: plotId, sceneId: null } });
  };

  const selectScene = (plotId: string, sceneId: string) => {
    persist({ ...state, selection: { plotPointId: plotId, sceneId } });
  };

  const addToken = (
    panel: PanelKey,
    payload: { label: string; details?: string; containsSpoiler?: boolean }
  ) => {
    const token: GlobalToken = {
      id: createId(),
      label: payload.label,
      details: payload.details,
      containsSpoiler: payload.containsSpoiler,
      source: "manual",
    };
    persist({
      ...state,
      globalRepos: { ...state.globalRepos, [panel]: [...state.globalRepos[panel], token] },
    });
  };

  const updateToken = (
    panel: PanelKey,
    tokenId: string,
    patch: Partial<Pick<GlobalToken, "label" | "details" | "containsSpoiler">>
  ) => {
    persist({
      ...state,
      globalRepos: {
        ...state.globalRepos,
        [panel]: state.globalRepos[panel].map((t) =>
          t.id === tokenId ? { ...t, ...patch } : t
        ),
      },
    });
  };

  const deleteToken = (panel: PanelKey, tokenId: string) => {
    persist({
      ...state,
      globalRepos: {
        ...state.globalRepos,
        [panel]: state.globalRepos[panel].filter((t) => t.id !== tokenId),
      },
      plotPoints: state.plotPoints.map((p) => ({
        ...p,
        scenes: p.scenes.map((s) => ({
          ...s,
          bindings: {
            ...s.bindings,
            [panel]: s.bindings[panel].filter((id) => id !== tokenId),
          },
        })),
      })),
    });
  };

  const toggleBinding = (panel: PanelKey, tokenId: string) => {
    if (!selectedScene || !state.selection.plotPointId) return;
    const plotId = state.selection.plotPointId;
    const sceneId = selectedScene.id;
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) => {
        if (p.id !== plotId) return p;
        return {
          ...p,
          scenes: p.scenes.map((s) => {
            if (s.id !== sceneId) return s;
            const cur = s.bindings[panel];
            const next = cur.includes(tokenId) ? cur.filter((id) => id !== tokenId) : [...cur, tokenId];
            return { ...s, bindings: { ...s.bindings, [panel]: next } };
          }),
        };
      }),
    });
  };

  const insertSlotButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-dashed border-zinc-800 py-1 text-[10px] text-zinc-500 transition hover:border-emerald-500/40 hover:text-emerald-300"
    >
      {label}
    </button>
  );

  const placeholder = (
    <p className="text-xs italic text-zinc-500">Select a scene to configure details</p>
  );

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0612]">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-violet-100">Plot Engine</h2>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Template
          <select
            value={state.templateId}
            onChange={(e) => changeTemplate(e.target.value as PlotTemplateId)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
          >
            <option value="save-the-cat">Save the Cat!</option>
            <option value="three-act">Three-Act Structure</option>
            <option value="custom">Custom Build</option>
          </select>
        </label>
        <span className="text-[10px] text-zinc-600">{sortedPlots.length} plot points</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="w-full min-w-0 flex-[3] overflow-y-auto p-4 lg:w-3/4">
          {state.templateId === "custom" && sortedPlots.length === 0 ? (
            <button
              type="button"
              onClick={addPlotPoint}
              className="w-full rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-950/20 py-12 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/60"
            >
              + Add Custom Plot Point
            </button>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-1">
              {sortedPlots.length > 0
                ? insertSlotButton("+ Add plot event at start", () => insertPlotPointAfter(null))
                : null}
              {sortedPlots.map((plot, plotIndex) => {
                const plotActive = state.selection.plotPointId === plot.id;
                const sortedScenes = [...plot.scenes].sort((a, b) => a.order - b.order);
                return (
                  <div key={plot.id} className="flex flex-col gap-1">
                    <article
                      className={[
                        "rounded-xl border bg-zinc-950/60 p-3 transition duration-200",
                        plotActive
                          ? "border-emerald-500/50 ring-2 ring-emerald-400/40"
                          : "border-zinc-700/50 hover:border-zinc-600",
                      ].join(" ")}
                      onClick={() => selectPlot(plot.id)}
                    >
                      <div className="mb-2 flex items-start gap-1">
                        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-zinc-600">
                          {plotIndex + 1}
                        </span>
                        <input
                          value={plot.title}
                          onChange={(e) => updatePlotTitle(plot.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none"
                        />
                        <button
                          type="button"
                          className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                          title="Move plot event up"
                          disabled={plotIndex === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            movePlotPoint(plot.id, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                          title="Move plot event down"
                          disabled={plotIndex === sortedPlots.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            movePlotPoint(plot.id, 1);
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="text-zinc-500 hover:text-rose-400"
                          title="Delete plot event"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePlotPoint(plot.id);
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div className="space-y-1">
                        {sortedScenes.length > 0
                          ? insertSlotButton("+ Scene here", () => insertSceneAfter(plot.id, null))
                          : null}
                        {sortedScenes.map((scene, sceneIndex) => {
                          const sceneActive =
                            state.selection.sceneId === scene.id &&
                            state.selection.plotPointId === plot.id;
                          return (
                            <div key={scene.id} className="flex flex-col gap-1">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectScene(plot.id, scene.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") selectScene(plot.id, scene.id);
                                }}
                                className={[
                                  "flex items-center gap-1 rounded-lg border-l-2 bg-zinc-900/80 py-2 pl-2 pr-1 text-xs transition",
                                  sceneActive
                                    ? "border-emerald-400 ring-1 ring-emerald-500/30"
                                    : "border-emerald-500/30 hover:border-emerald-400/50",
                                ].join(" ")}
                              >
                                <input
                                  value={scene.title}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const title = e.target.value;
                                    persist({
                                      ...state,
                                      plotPoints: state.plotPoints.map((p) =>
                                        p.id === plot.id
                                          ? {
                                              ...p,
                                              scenes: p.scenes.map((s) =>
                                                s.id === scene.id ? { ...s, title } : s
                                              ),
                                            }
                                          : p
                                      ),
                                    });
                                  }}
                                  className="min-w-0 flex-1 bg-transparent text-zinc-200 outline-none"
                                />
                                <button
                                  type="button"
                                  className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                                  disabled={sceneIndex === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveScene(plot.id, scene.id, -1);
                                  }}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                                  disabled={sceneIndex === sortedScenes.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveScene(plot.id, scene.id, 1);
                                  }}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="text-zinc-500 hover:text-rose-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteScene(plot.id, scene.id);
                                  }}
                                >
                                  🗑
                                </button>
                              </div>
                              {insertSlotButton("+ Scene here", () =>
                                insertSceneAfter(plot.id, scene.id)
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="mt-2 w-full rounded border border-zinc-700 py-1 text-xs text-emerald-300/90 hover:bg-emerald-950/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          addScene(plot.id);
                        }}
                      >
                        + Add scene at end
                      </button>
                    </article>
                    {insertSlotButton("+ Add plot event here", () => insertPlotPointAfter(plot.id))}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addPlotPoint}
                className="mt-1 flex min-h-[3rem] items-center justify-center rounded-xl border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-300"
              >
                + Add plot event at end
              </button>
            </div>
          )}
        </div>

        <aside
          className={[
            "w-full shrink-0 border-t border-emerald-500/20 bg-emerald-950/20 p-3 lg:w-1/4 lg:border-l lg:border-t-0",
            panelsActive ? "opacity-100" : "opacity-50",
          ].join(" ")}
        >
          {panelsActive && selectedScene ? (
            <>
              <BlockInputModeToggle
                mode={sceneInputMode(selectedScene)}
                onChange={setBlockInputMode}
              />
              <div className="mb-4 border-b border-emerald-900/30 pb-3">
                <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
                  Synopsis
                </h3>
                <textarea
                  value={selectedScene.synopsis ?? ""}
                  onChange={(e) => {
                    const synopsis = e.target.value;
                    persist({
                      ...state,
                      plotPoints: state.plotPoints.map((p) =>
                        p.id === state.selection.plotPointId
                          ? {
                              ...p,
                              scenes: p.scenes.map((s) =>
                                s.id === selectedScene.id ? { ...s, synopsis } : s
                              ),
                            }
                          : p
                      ),
                    });
                  }}
                  placeholder="Beat body / scene synopsis"
                  className="min-h-[72px] w-full rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/50"
                />
              </div>
              {SIDEBAR_PANELS.map((panel) => (
              <section key={panel} className="mb-4 border-b border-emerald-900/30 pb-3 last:mb-0">
                <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
                  {PANEL_LABELS[panel]}
                </h3>
                {outlineMode ? (
                  <OutlineRagPanel
                    panel={panel}
                    fields={selectedScene.outlineRagFields?.[panel] ?? {}}
                    accent="emerald"
                    manuscriptId={manuscriptId}
                    onFieldChange={(key, value) => updateOutlineRagField(panel, key, value)}
                  />
                ) : (
                  <TokenPool
                    panel={panel}
                    tokens={state.globalRepos[panel]}
                    boundIds={selectedScene.bindings[panel]}
                    active
                    accent="emerald"
                    onAdd={(payload) => addToken(panel, payload)}
                    onUpdate={(id, patch) => updateToken(panel, id, patch)}
                    onDelete={(id) => deleteToken(panel, id)}
                    onToggle={(id) => toggleBinding(panel, id)}
                  />
                )}
              </section>
            ))}
            </>
          ) : (
            <div className="flex min-h-[12rem] items-center justify-center">{placeholder}</div>
          )}
        </aside>
      </div>

      <footer
        className={[
          "border-t border-violet-500/25 bg-violet-950/30 p-3",
          panelsActive ? "opacity-100" : "opacity-50",
        ].join(" ")}
      >
        {panelsActive && selectedScene ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {SHELF_PANELS.map((panel) => (
              <section key={panel}>
                <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/90">
                  {PANEL_LABELS[panel]}
                </h3>
                {outlineMode ? (
                  <OutlineRagPanel
                    panel={panel}
                    fields={selectedScene.outlineRagFields?.[panel] ?? {}}
                    accent="violet"
                    manuscriptId={manuscriptId}
                    onFieldChange={(key, value) => updateOutlineRagField(panel, key, value)}
                  />
                ) : (
                  <TokenPool
                    panel={panel}
                    tokens={state.globalRepos[panel]}
                    boundIds={selectedScene.bindings[panel]}
                    active
                    accent="violet"
                    onAdd={(payload) => addToken(panel, payload)}
                    onUpdate={(id, patch) => updateToken(panel, id, patch)}
                    onDelete={(id) => deleteToken(panel, id)}
                    onToggle={(id) => toggleBinding(panel, id)}
                  />
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">{placeholder}</div>
        )}
      </footer>
    </div>
  );
}

export function getPlotEngineSyncPayload(manuscriptId: string) {
  const state = loadPlotEngineState(manuscriptId);
  if (!state) return null;
  return toSyncPayload(state);
}

export function applyFileImportToPlotEngine(
  manuscriptId: string,
  proposed: Parameters<typeof hydratePlotEngineFromIngest>[1],
  beats: Parameters<typeof hydratePlotEngineFromIngest>[2]
) {
  const base = loadPlotEngineState(manuscriptId) ?? defaultPlotEngineState("custom");
  const next = hydratePlotEngineFromIngest(base, proposed, beats);
  savePlotEngineState(manuscriptId, next);
  return next;
}
