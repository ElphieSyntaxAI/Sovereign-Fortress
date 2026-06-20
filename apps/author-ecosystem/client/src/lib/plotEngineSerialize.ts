import type { PlotBeat } from "../planning/PlanningSessionContext";
import {
  PANEL_LABELS,
  resolveTokenLabels,
  type PanelKey,
  type PlotEngineState,
  type PlotPoint,
  type Scene,
} from "./plotEngineTypes";

function ragTagLine(state: PlotEngineState, scene: Scene): string {
  const parts: string[] = [];
  const push = (panel: PanelKey, prefix: string) => {
    const labels = resolveTokenLabels(state, panel, scene.bindings[panel] ?? []);
    if (labels.length) parts.push(`${prefix}: ${labels.join(", ")}`);
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

function sceneSynopsis(state: PlotEngineState, plot: PlotPoint, scene: Scene): string {
  const header = `[${plot.title}] ${scene.title}`.trim();
  const tags = ragTagLine(state, scene);
  const lines = [header];
  if (tags) lines.push(tags);
  for (const panel of Object.keys(PANEL_LABELS) as PanelKey[]) {
    const labels = resolveTokenLabels(state, panel, scene.bindings[panel] ?? []);
    if (labels.length) {
      lines.push(`${PANEL_LABELS[panel].toUpperCase()}: ${labels.join(", ")}`);
    }
  }
  return lines.join("\n").trim();
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
