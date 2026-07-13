import type {
  DocumentIngestCompilerState,
  EntityRecord,
  PlotBeatRecord,
  StructuralMacroWindow,
  WindowMetacognition,
} from "../types";

export function loadPass1InputGate(
  window: StructuralMacroWindow,
  _state: DocumentIngestCompilerState
): { window: StructuralMacroWindow; entityDictionary: EntityRecord[] } {
  return { window, entityDictionary: [] };
}

export function loadPass2InputGate(
  window: StructuralMacroWindow,
  state: DocumentIngestCompilerState
): { window: StructuralMacroWindow; entityDictionary: EntityRecord[] } {
  return { window, entityDictionary: state.entities };
}

export function loadPass3InputGate(
  window: StructuralMacroWindow,
  state: DocumentIngestCompilerState
): {
  window: StructuralMacroWindow;
  entityDictionary: EntityRecord[];
  plotBeats: PlotBeatRecord[];
} {
  const beatsInWindow = state.plot_beats.filter((b) => b.source_window_id === window.window_id);
  return {
    window,
    entityDictionary: state.entities,
    plotBeats: beatsInWindow.length ? beatsInWindow : state.plot_beats,
  };
}

export function formatEntityDictionaryForPrompt(entities: EntityRecord[]): string {
  if (!entities.length) return "(no entities yet)";
  return entities
    .slice(0, 80)
    .map((e) => `- ${e.entity_fingerprint} | ${e.kind} | ${e.name} | traits: ${e.traits.join(", ")}`)
    .join("\n");
}

export function formatPlotBeatsForPrompt(beats: PlotBeatRecord[]): string {
  if (!beats.length) return "(no plot beats yet)";
  return beats
    .slice(0, 60)
    .map(
      (b) =>
        `- ${b.beat_id} order=${b.order} entities=[${b.active_entity_fingerprints.join(", ")}] ${b.synopsis.slice(0, 120)}`
    )
    .join("\n");
}

export function filterLocalMetacognitionContext(
  window: StructuralMacroWindow,
  state: DocumentIngestCompilerState
): {
  entities: EntityRecord[];
  beats: PlotBeatRecord[];
} {
  const entities = state.entities.filter((e) => e.source_window_ids.includes(window.window_id));
  const beats = state.plot_beats.filter((b) => b.source_window_id === window.window_id);
  return {
    entities: entities.length ? entities : state.entities.slice(0, 12),
    beats: beats.length ? beats : state.plot_beats.slice(0, 8),
  };
}

export function mergeMetacognitionIntoState(
  state: DocumentIngestCompilerState,
  entry: WindowMetacognition
): DocumentIngestCompilerState {
  const rest = state.window_metacognition.filter((w) => w.window_id !== entry.window_id);
  return { ...state, window_metacognition: [...rest, entry] };
}
