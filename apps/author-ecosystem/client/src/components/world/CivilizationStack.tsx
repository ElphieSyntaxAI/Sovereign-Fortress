import { StackLayerCard } from "./StackLayerCard";
import { CIVILIZATION_STACK_LAYER_ORDER } from "../../lib/worldBuildTypes";
import type { CivilizationStackLayer, StackEntry } from "../../lib/worldBuildTypes";

export function CivilizationStack(props: {
  locationTitle: string;
  entries: StackEntry[];
  selectedId: string | null;
  manuscriptId: string;
  onAddEntry: (layer: CivilizationStackLayer) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, patch: Partial<StackEntry>) => void;
  onFieldChange: (id: string, key: string, value: string) => void;
  onModeChange: (id: string, mode: "freestyle" | "outline") => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-emerald-100">Civilization stack</h2>
      <p className="text-[10px] text-zinc-500">
        Build every layer of culture for <strong className="text-zinc-400">{props.locationTitle}</strong>.
        New entries inherit this location automatically when saved.
      </p>
      {CIVILIZATION_STACK_LAYER_ORDER.map((layer) => (
        <StackLayerCard
          key={layer}
          layer={layer}
          entries={props.entries.filter((e) => e.layer === layer)}
          selectedId={props.selectedId}
          parentTitle={props.locationTitle}
          manuscriptId={props.manuscriptId}
          onAdd={() => props.onAddEntry(layer)}
          onSelect={props.onSelect}
          onDelete={props.onDelete}
          onPatch={props.onPatch}
          onFieldChange={props.onFieldChange}
          onModeChange={props.onModeChange}
        />
      ))}
    </div>
  );
}
