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

export type BlockInputMode = "freestyle" | "outline";

export type OutlineRagFields = Partial<Record<PanelKey, Record<string, string>>>;

export type GlobalToken = {
  id: string;
  label: string;
  /** Lore notes for this building block (character bio, setting facts, etc.). */
  details?: string;
  /** When true, details are treated as spoiler-sensitive in sync / RAG tags. */
  containsSpoiler?: boolean;
  source?: "manual" | "ingest" | "wiki";
  wikiChunkId?: string;
  outlineEntityKind?: string;
};

export type Scene = {
  id: string;
  title: string;
  /** Beat body / synopsis separate from display title (file-import outline rows). */
  synopsis?: string;
  order: number;
  bindings: Record<PanelKey, string[]>;
  /** Freestyle = token chips; outline = RAG-guided field groups. */
  blockInputMode?: BlockInputMode;
  /** Structured RAG field values per panel (outline mode). */
  outlineRagFields?: OutlineRagFields;
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

/** Sort plot points and assign contiguous order indices. */
export function reindexPlotPoints(plotPoints: PlotPoint[]): PlotPoint[] {
  return [...plotPoints]
    .sort((a, b) => a.order - b.order)
    .map((p, order) => ({ ...p, order }));
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
    .map((id) => pool.find((t) => t.id === id))
    .filter((t): t is GlobalToken => Boolean(t?.label?.trim()))
    .map((t) => formatBuildingBlockToken(t));
}

/** Display / sync line for a pool token (name + optional details + spoiler flag). */
export function formatBuildingBlockToken(token: GlobalToken): string {
  const name = token.label.trim();
  const details = token.details?.trim();
  if (!details) return name;
  if (token.containsSpoiler) return `${name} (spoiler): ${details}`;
  return `${name} — ${details}`;
}

export type FlatPlotBeat = PlotBeat;
