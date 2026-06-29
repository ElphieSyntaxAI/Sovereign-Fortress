import type { PlotBeat } from "../planning/PlanningSessionContext";
import {
  buildPanelRagLine,
  getOutlineFieldValue,
} from "./plotEngineRagOutlineSchema";
import {
  PANEL_KEYS,
  PANEL_LABELS,
  formatBuildingBlockToken,
  type GlobalToken,
  type PanelKey,
  type PlotEngineState,
  type PlotPoint,
  type Scene,
} from "./plotEngineTypes";

function ragTagLine(state: PlotEngineState, scene: Scene): string {
  const parts: string[] = [];
  const push = (panel: PanelKey, prefix: string) => {
    const pool = state.globalRepos[panel] ?? [];
    const ids = scene.bindings[panel] ?? [];
    const tokens = ids
      .map((id) => pool.find((t) => t.id === id))
      .filter((t): t is GlobalToken => Boolean(t?.label?.trim()));
    if (!tokens.length) return;
    const labels = tokens.map((t) => {
      const base = t.label.trim();
      if (t.containsSpoiler) return `${base} | Spoiler Level: high`;
      return base;
    });
    parts.push(`${prefix}: ${labels.join(", ")}`);
  };
  push("character", "RAG TAG: [Character Name");
  push("environmental", "[Environmental tag");
  push("settings", "[Setting");
  push("theme", "[Theme");
  push("mood", "[Tone");
  push("spoilerLevel", "[Spoiler Level");
  push("senses", "SENSES TAG");
  push("breadcrumbs", "[Breadcrumb");
  if (parts.length === 0) return "";
  return `${parts.join("] | ")}]`;
}

function ragLinesFromOutline(scene: Scene, plot: PlotPoint): string[] {
  const fields = scene.outlineRagFields ?? {};
  const lines: string[] = [];

  const spoilerPanel = fields.spoilerLevel ?? {};
  const plotPoint = getOutlineFieldValue(spoilerPanel, "plotPoint") || plot.title.trim();
  const spoilerLevel = getOutlineFieldValue(spoilerPanel, "spoilerLevel");
  const era = getOutlineFieldValue(spoilerPanel, "era");
  const headerParts: string[] = [];
  if (era) headerParts.push(`[Era: ${era}]`);
  if (plotPoint) headerParts.push(`[Plot-Point: ${plotPoint}]`);
  if (spoilerLevel) {
    const cap = spoilerLevel.charAt(0).toUpperCase() + spoilerLevel.slice(1).toLowerCase();
    headerParts.push(`[Spoiler Level: ${cap}]`);
  }
  if (headerParts.length) {
    lines.push(`RAG TAG: ${headerParts.join(" | ")}`);
  }

  const sensesLine = buildPanelRagLine("senses", fields.senses);
  if (sensesLine) lines.push(sensesLine);

  for (const panel of PANEL_KEYS) {
    if (panel === "senses" || panel === "spoilerLevel") continue;
    const line = buildPanelRagLine(panel, fields[panel]);
    if (line) lines.push(line);
  }

  return lines;
}

function sceneSynopsisFreestyle(state: PlotEngineState, plot: PlotPoint, scene: Scene): string {
  const header = `[${plot.title}] ${scene.title}`.trim();
  const body = scene.synopsis?.trim();
  if (body) {
    const tags = ragTagLine(state, scene);
    const lines = [header, body];
    if (tags) lines.push(tags);
    return lines.join("\n").trim();
  }
  const tags = ragTagLine(state, scene);
  const lines = [header];
  if (tags) lines.push(tags);
  for (const panel of Object.keys(PANEL_LABELS) as PanelKey[]) {
    const pool = state.globalRepos[panel] ?? [];
    const tokens = (scene.bindings[panel] ?? [])
      .map((id) => pool.find((t) => t.id === id))
      .filter((t): t is GlobalToken => Boolean(t?.label?.trim()));
    if (tokens.length) {
      lines.push(
        `${PANEL_LABELS[panel].toUpperCase()}: ${tokens.map((t) => formatBuildingBlockToken(t)).join("; ")}`
      );
    }
  }
  return lines.join("\n").trim();
}

function sceneSynopsisOutline(plot: PlotPoint, scene: Scene): string {
  const header = `[${plot.title}] ${scene.title}`.trim();
  const body = scene.synopsis?.trim();
  const ragLines = ragLinesFromOutline(scene, plot);
  const lines = [header];
  if (body) lines.push(body);
  lines.push(...ragLines);
  return lines.join("\n").trim();
}

function sceneSynopsis(state: PlotEngineState, plot: PlotPoint, scene: Scene): string {
  if (scene.blockInputMode === "outline") {
    return sceneSynopsisOutline(plot, scene);
  }
  return sceneSynopsisFreestyle(state, plot, scene);
}

/** Flatten plot engine into plotBeats for sync-session (one beat per scene, else per plot point). */
export function flattenPlotEngineToBeats(state: PlotEngineState): PlotBeat[] {
  const beats: PlotBeat[] = [];
  let order = 0;
  const sorted = [...state.plotPoints].sort((a, b) => a.order - b.order);
  for (const plot of sorted) {
    const scenes = [...plot.scenes].sort((a, b) => a.order - b.order);
    if (scenes.length === 0) {
      beats.push({
        id: plot.id,
        synopsis: plot.title,
        order: order++,
      });
      continue;
    }
    for (const scene of scenes) {
      beats.push({
        id: scene.id,
        synopsis: sceneSynopsis(state, plot, scene),
        order: order++,
      });
    }
  }
  return beats;
}
