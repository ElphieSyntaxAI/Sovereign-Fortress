import { useCallback, useEffect, useMemo, useState } from "react";

import { hydratePlotEngineFromIngest } from "../lib/plotEngineHydrate";
import { flattenPlotEngineToBeats } from "../lib/plotEngineSerialize";
import { loadPlotEngineState, savePlotEngineState } from "../lib/plotEngineStorage";
import {
  createId,
  createPlotPoint,
  createScene,
  defaultPlotEngineState,
  PANEL_LABELS,
  seedPlotPoints,
  SHELF_PANELS,
  SIDEBAR_PANELS,
  type GlobalToken,
  type PanelKey,
  type PlotEngineState,
  type PlotPoint,
  type PlotTemplateId,
  toSyncPayload,
} from "../lib/plotEngineTypes";
import { usePlanningSession } from "../planning/PlanningSessionContext";
import { DOCUMENT_INGEST_COMMITTED_EVENT, type DocumentIngestCommittedDetail } from "../lib/documentIngestEvents";

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

function TokenPool(props: {
  panel: PanelKey;
  tokens: GlobalToken[];
  boundIds: string[];
  active: boolean;
  accent: "emerald" | "violet";
  onAdd: (label: string) => void;
  onDelete: (tokenId: string) => void;
  onToggle: (tokenId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const ring = props.accent === "emerald" ? "ring-emerald-400/70" : "ring-violet-400/70";
  const chipOn =
    props.accent === "emerald"
      ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-100"
      : "border-violet-500/60 bg-violet-950/50 text-violet-100";
  const chipOff = "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {props.tokens.map((t) => {
          const bound = props.boundIds.includes(t.id);
          return (
            <span key={t.id} className="inline-flex items-center gap-0.5">
              <button
                type="button"
                disabled={!props.active}
                onClick={() => props.onToggle(t.id)}
                className={[
                  "rounded-full border px-2 py-0.5 text-xs transition",
                  bound ? `${chipOn} ${props.active ? ring : ""}` : chipOff,
                  !props.active ? "cursor-default opacity-60" : "",
                ].join(" ")}
              >
                {t.label}
              </button>
              <button
                type="button"
                className="text-[10px] text-zinc-500 hover:text-rose-400"
                title="Remove from pool"
                onClick={() => props.onDelete(t.id)}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ Add item"
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              props.onAdd(draft.trim());
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300"
          onClick={() => {
            if (!draft.trim()) return;
            props.onAdd(draft.trim());
            setDraft("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
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
        reloadPlotBeatsFromStorage();
      }
    };
    window.addEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
    return () => window.removeEventListener(DOCUMENT_INGEST_COMMITTED_EVENT, onIngest);
  }, [manuscriptId, reloadPlotBeatsFromStorage, setPlotBeats]);

  const selectedScene =
    state.selection.plotPointId && state.selection.sceneId
      ? findScene(state, state.selection.plotPointId, state.selection.sceneId)
      : undefined;
  const panelsActive = Boolean(selectedScene);

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
    persist({
      ...state,
      plotPoints: [...state.plotPoints, createPlotPoint("Custom beat", state.plotPoints.length)],
    });
  };

  const deletePlotPoint = (plotId: string) => {
    persist({
      ...state,
      plotPoints: state.plotPoints.filter((p) => p.id !== plotId),
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

  const addScene = (plotId: string) => {
    persist({
      ...state,
      plotPoints: state.plotPoints.map((p) => {
        if (p.id !== plotId) return p;
        const scene = createScene(`Scene ${p.scenes.length + 1}`);
        scene.order = p.scenes.length;
        return { ...p, scenes: [...p.scenes, scene] };
      }),
    });
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

  const addToken = (panel: PanelKey, label: string) => {
    const token: GlobalToken = { id: createId(), label, source: "manual" };
    persist({
      ...state,
      globalRepos: { ...state.globalRepos, [panel]: [...state.globalRepos[panel], token] },
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

  const sortedPlots = useMemo(
    () => [...state.plotPoints].sort((a, b) => a.order - b.order),
    [state.plotPoints]
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedPlots.map((plot) => {
                const plotActive = state.selection.plotPointId === plot.id;
                return (
                  <article
                    key={plot.id}
                    className={[
                      "rounded-xl border bg-zinc-950/60 p-3 transition duration-200",
                      plotActive
                        ? "scale-[1.02] border-emerald-500/50 ring-2 ring-emerald-400/40"
                        : "border-zinc-700/50 hover:border-zinc-600",
                    ].join(" ")}
                    onClick={() => selectPlot(plot.id)}
                  >
                    <div className="mb-2 flex items-start gap-1">
                      <input
                        value={plot.title}
                        onChange={(e) => updatePlotTitle(plot.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none"
                      />
                      <button
                        type="button"
                        className="text-zinc-500 hover:text-rose-400"
                        title="Delete plot point"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePlotPoint(plot.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {[...plot.scenes]
                        .sort((a, b) => a.order - b.order)
                        .map((scene) => {
                          const sceneActive =
                            state.selection.sceneId === scene.id &&
                            state.selection.plotPointId === plot.id;
                          return (
                            <div
                              key={scene.id}
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
                                className="px-0.5 text-zinc-500 hover:text-zinc-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveScene(plot.id, scene.id, -1);
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="px-0.5 text-zinc-500 hover:text-zinc-200"
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
                      + Add New Scene
                    </button>
                  </article>
                );
              })}
              {state.templateId === "custom" ? (
                <button
                  type="button"
                  onClick={addPlotPoint}
                  className="flex min-h-[8rem] items-center justify-center rounded-xl border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-300"
                >
                  + Add Custom Plot Point
                </button>
              ) : null}
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
            SIDEBAR_PANELS.map((panel) => (
              <section key={panel} className="mb-4 border-b border-emerald-900/30 pb-3 last:mb-0">
                <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
                  {PANEL_LABELS[panel]}
                </h3>
                <TokenPool
                  panel={panel}
                  tokens={state.globalRepos[panel]}
                  boundIds={selectedScene.bindings[panel]}
                  active
                  accent="emerald"
                  onAdd={(label) => addToken(panel, label)}
                  onDelete={(id) => deleteToken(panel, id)}
                  onToggle={(id) => toggleBinding(panel, id)}
                />
              </section>
            ))
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
                <TokenPool
                  panel={panel}
                  tokens={state.globalRepos[panel]}
                  boundIds={selectedScene.bindings[panel]}
                  active
                  accent="violet"
                  onAdd={(label) => addToken(panel, label)}
                  onDelete={(id) => deleteToken(panel, id)}
                  onToggle={(id) => toggleBinding(panel, id)}
                />
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
