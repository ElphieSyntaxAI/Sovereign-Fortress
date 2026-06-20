import type { PlotBeat } from "../planning/PlanningSessionContext";

export type PlotTemplateId = "save-the-cat" | "three-act" | "custom";

export type PanelKey =
  | "character"
  | "settings"
  | "environmental"
  | "senses"
  | "theme"
  | "mood"
  | "spoilerLevel"
  | "breadcrumbs";

export const PANEL_KEYS: PanelKey[] = [
  "character",
  "settings",
  "environmental",
  "senses",
  "theme",
  "mood",
  "spoilerLevel",
  "breadcrumbs",
];

export const SIDEBAR_PANELS: PanelKey[] = ["character", "settings", "environmental"];
export const SHELF_PANELS: PanelKey[] = ["senses", "theme", "mood", "spoilerLevel", "breadcrumbs"];

export const PANEL_LABELS: Record<PanelKey, string> = {
  character: "Character",
  settings: "Settings",
  environmental: "Environmental",
  senses: "Senses",
  theme: "Theme",
  mood: "Mood",
  spoilerLevel: "Spoiler Level",
  breadcrumbs: "Breadcrumbs",
};

export type GlobalToken = {
  id: string;
  label: string;
  source?: "manual" | "ingest" | "wiki";
  wikiChunkId?: string;
  outlineEntityKind?: string;
};

export type Scene = {
  id: string;
  title: string;
  order: number;
  bindings: Record<PanelKey, string[]>;
};

export type PlotPoint = {
  id: string;
  title: string;
  order: number;
  scenes: Scene[];
};

export type PlotEngineState = {
  templateId: PlotTemplateId;
  plotPoints: PlotPoint[];
  globalRepos: Record<PanelKey, GlobalToken[]>;
  selection: { plotPointId: string | null; sceneId: string | null };
};

export const SAVE_THE_CAT_BEATS = [
  "Opening Image",
  "Theme Stated",
  "Setup",
  "Catalyst",
  "Debate",
  "Break into Two",
  "B Story",
  "Fun and Games",
  "Midpoint",
  "Bad Guys Close In",
  "All Is Lost",
  "Dark Night of the Soul",
  "Break into Three",
  "Finale",
  "Final Image",
];

export const THREE_ACT_BEATS = [
  "Act I — Setup",
  "Inciting Incident",
  "Plot Point I",
  "Act II — Confrontation",
  "Midpoint",
  "Plot Point II",
  "Act III — Resolution",
  "Denouement",
];

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyBindings(): Record<PanelKey, string[]> {
  return {
    character: [],
    settings: [],
    environmental: [],
    senses: [],
    theme: [],
    mood: [],
    spoilerLevel: [],
    breadcrumbs: [],
  };
}

export function emptyGlobalRepos(): Record<PanelKey, GlobalToken[]> {
  return {
    character: [],
    settings: [],
    environmental: [],
    senses: [],
    theme: [],
    mood: [],
    spoilerLevel: [],
    breadcrumbs: [],
  };
}

export function createScene(title = "New scene"): Scene {
  return {
    id: createId(),
    title,
    order: 0,
    bindings: emptyBindings(),
  };
}

export function createPlotPoint(title: string, order: number): PlotPoint {
  return {
    id: createId(),
    title,
    order,
    scenes: [],
  };
}

export function seedPlotPoints(templateId: PlotTemplateId): PlotPoint[] {
  const titles =
    templateId === "save-the-cat"
      ? SAVE_THE_CAT_BEATS
      : templateId === "three-act"
        ? THREE_ACT_BEATS
        : [];
  return titles.map((title, order) => createPlotPoint(title, order));
}

export function defaultPlotEngineState(templateId: PlotTemplateId = "custom"): PlotEngineState {
  return {
    templateId,
    plotPoints: seedPlotPoints(templateId),
    globalRepos: emptyGlobalRepos(),
    selection: { plotPointId: null, sceneId: null },
  };
}

export type PlotEngineSyncPayload = {
  templateId: PlotTemplateId;
  plotPoints: PlotPoint[];
  globalRepos: Record<PanelKey, GlobalToken[]>;
};

export function toSyncPayload(state: PlotEngineState): PlotEngineSyncPayload {
  return {
    templateId: state.templateId,
    plotPoints: state.plotPoints,
    globalRepos: state.globalRepos,
  };
}

export function resolveTokenLabels(
  state: PlotEngineState,
  panel: PanelKey,
  tokenIds: string[]
): string[] {
  const pool = state.globalRepos[panel] ?? [];
  return tokenIds
    .map((id) => pool.find((t) => t.id === id)?.label)
    .filter((l): l is string => Boolean(l?.trim()));
}

export type FlatPlotBeat = PlotBeat;
