import { defaultPlotEngineState, type PlotEngineState, type PlotTemplateId } from "./plotEngineTypes";

const KEY_PREFIX = "elphie:plot-engine:";

export function plotEngineStorageKey(manuscriptId: string): string {
  return `${KEY_PREFIX}${manuscriptId}`;
}

export function loadPlotEngineState(manuscriptId: string): PlotEngineState | null {
  if (!manuscriptId.trim()) return null;
  try {
    const raw = localStorage.getItem(plotEngineStorageKey(manuscriptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlotEngineState;
    if (!parsed || !Array.isArray(parsed.plotPoints) || !parsed.globalRepos) return null;
    return {
      ...defaultPlotEngineState("custom"),
      ...parsed,
      selection: parsed.selection ?? { plotPointId: null, sceneId: null },
    };
  } catch {
    return null;
  }
}

export function savePlotEngineState(manuscriptId: string, state: PlotEngineState): void {
  if (!manuscriptId.trim()) return;
  try {
    localStorage.setItem(plotEngineStorageKey(manuscriptId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function clearPlotEngineState(manuscriptId: string): void {
  try {
    localStorage.removeItem(plotEngineStorageKey(manuscriptId));
  } catch {
    /* ignore */
  }
}

export function ensurePlotEngineState(
  manuscriptId: string,
  templateId: PlotTemplateId = "custom"
): PlotEngineState {
  return loadPlotEngineState(manuscriptId) ?? defaultPlotEngineState(templateId);
}
