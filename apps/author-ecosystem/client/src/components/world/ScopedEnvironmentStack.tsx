import { CivilizationStack } from "./CivilizationStack";
import { getEnvironmentSchemaForKind } from "../../lib/civilizationStackSchema";
import { ECOLOGY_STACK_LAYERS } from "../../lib/worldBuildTypes";
import type { LocationKind, StackEntry } from "../../lib/worldBuildTypes";
import type { CivilizationStackLayer } from "../../lib/worldBuildTypes";

export function EcologyStackPanel(props: {
  locationKind: LocationKind;
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
  const envSchema = getEnvironmentSchemaForKind(props.locationKind);
  const hasEnvFields = (envSchema.sections?.length ?? 0) > 0;
  const layers = hasEnvFields
    ? ECOLOGY_STACK_LAYERS
    : ECOLOGY_STACK_LAYERS.filter((l) => l !== "environment");

  if (!layers.length) return null;

  return (
    <CivilizationStack
      locationTitle={props.locationTitle}
      entries={props.entries}
      selectedId={props.selectedId}
      manuscriptId={props.manuscriptId}
      layers={layers}
      environmentSchema={hasEnvFields ? envSchema : undefined}
      heading="Ecology & physical world"
      hint="Environment (suns, tidal lock, climate), fauna, and flora for this place. Hierarchy path is stamped into tags on create."
      onAddEntry={props.onAddEntry}
      onSelect={props.onSelect}
      onDelete={props.onDelete}
      onPatch={props.onPatch}
      onFieldChange={props.onFieldChange}
      onModeChange={props.onModeChange}
    />
  );
}

/** @deprecated use EcologyStackPanel */
export const ScopedEnvironmentStack = EcologyStackPanel;
