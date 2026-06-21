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
  if (beats.length > 0) {
    if (plotPoints.length === 0) {
      plotPoints = beats
        .filter((b) => String(b.synopsis ?? b.title ?? "").trim())
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((b, i) => {
          const title = String(b.title ?? `Beat ${i + 1}`).trim();
          const synopsis = String(b.synopsis ?? "").trim();
          const pp = createPlotPoint(title, i);
          const scene = createScene(title);
          scene.order = 0;
          if (synopsis && synopsis !== title) scene.synopsis = synopsis;
          pp.scenes = [scene];
          return pp;
        });
    } else {
      const sorted = beats
        .filter((b) => String(b.synopsis ?? b.title ?? "").trim())
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
      for (let i = 0; i < sorted.length && i < plotPoints.length; i++) {
        const b = sorted[i]!;
        const plot = plotPoints[i]!;
        if (plot.scenes.length === 0) {
          const title = String(b.title ?? plot.title).trim();
          const scene = createScene(title);
          const synopsis = String(b.synopsis ?? "").trim();
          if (synopsis && synopsis !== title) scene.synopsis = synopsis;
          plot.scenes = [scene];
        } else if (plot.scenes.length === 1) {
          const scene = plot.scenes[0]!;
          const title = String(b.title ?? scene.title).trim();
          const synopsis = String(b.synopsis ?? "").trim();
          if (title && title !== scene.title) scene.title = title;
          if (synopsis && synopsis !== title) scene.synopsis = synopsis;
        }
      }
    }
  }

  return {
    ...base,
    globalRepos,
    plotPoints,
  };
}
