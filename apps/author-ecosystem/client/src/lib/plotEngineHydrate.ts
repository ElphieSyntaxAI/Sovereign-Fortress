import {
  createId,
  createPlotPoint,
  createScene,
  emptyGlobalRepos,
  type GlobalToken,
  type PanelKey,
  type PlotEngineState,
  type PlotPoint,
} from "./plotEngineTypes";

type IngestWikiRow = {
  title?: string;
  excerpt?: string;
  chunk_type?: string;
  wiki_metadata?: { outline_entity_kind?: string };
};

type IngestBeat = {
  synopsis?: string;
  order?: number;
  title?: string;
};

const KIND_TO_PANEL: Record<string, PanelKey> = {
  character: "character",
  setting: "settings",
  technology: "settings",
  environment: "environmental",
  theme: "theme",
  genre: "theme",
  spoiler: "spoilerLevel",
  plot_point: "breadcrumbs",
  note: "breadcrumbs",
  chapter: "breadcrumbs",
};

function panelForKind(kind: string): PanelKey {
  return KIND_TO_PANEL[kind] ?? "breadcrumbs";
}

function upsertToken(
  repos: Record<PanelKey, GlobalToken[]>,
  panel: PanelKey,
  label: string,
  kind?: string
): GlobalToken {
  const trimmed = label.trim();
  const existing = repos[panel].find((t) => t.label.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const token: GlobalToken = {
    id: createId(),
    label: trimmed,
    source: "ingest",
    outlineEntityKind: kind,
  };
  repos[panel].push(token);
  return token;
}

/** Merge document ingest / wiki rows into plot engine global repos (+ optional plot points from beats). */
export function hydratePlotEngineFromIngest(
  base: PlotEngineState,
  proposed: IngestWikiRow[],
  beats: IngestBeat[] = []
): PlotEngineState {
  const globalRepos = { ...emptyGlobalRepos() };
  for (const k of Object.keys(globalRepos) as PanelKey[]) {
    globalRepos[k] = [...(base.globalRepos[k] ?? [])];
  }

  for (const row of proposed) {
    const title = String(row.title ?? "").trim();
    const kind = String(row.wiki_metadata?.outline_entity_kind ?? row.chunk_type ?? "note").trim();
    if (!title) continue;
    upsertToken(globalRepos, panelForKind(kind), title, kind);
  }

  let plotPoints: PlotPoint[] = [...base.plotPoints];
  if (beats.length > 0 && plotPoints.length === 0) {
    plotPoints = beats
      .filter((b) => String(b.synopsis ?? b.title ?? "").trim())
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .map((b, i) => {
        const pp = createPlotPoint(String(b.title ?? `Beat ${i + 1}`).trim(), i);
        const scene = createScene(String(b.synopsis ?? b.title ?? "Scene").trim());
        scene.order = 0;
        pp.scenes = [scene];
        return pp;
      });
  }

  return {
    ...base,
    globalRepos,
    plotPoints,
  };
}
