import { createId } from "./plotEngineTypes";
import type { BlockInputMode } from "./plotEngineTypes";
import type { PlanningBlockEntity, WikiEntityRef } from "./planningBlockTypes";

export type StoryScope = "local" | "global" | "universe";

export type LocationKind =
  | "universe"
  | "galaxy"
  | "solar_system"
  | "planet"
  | "continent"
  | "city"
  | "district"
  | "neighborhood"
  | "venue";

export type CivilizationStackLayer =
  | "environment"
  | "species"
  | "government"
  | "beliefs"
  | "fauna"
  | "flora_food";

export type LocationNode = {
  id: string;
  parentId: string | null;
  kind: LocationKind;
  title: string;
  authorTags?: string[];
  wikiRef?: WikiEntityRef;
};

export type StackEntry = PlanningBlockEntity & {
  locationId: string;
  layer: CivilizationStackLayer;
  /** Set on create; used for RAG Parent stamp (not shown as primary label). */
  stampedParentTitle?: string;
  /** Flat hierarchy tags stamped on create, e.g. hierarchy:solar_system:andromeda */
  contextPathTags?: string[];
  /** Human path for RAG parent line, e.g. "Andromeda › Kepler-9 › Port Helix" */
  stampedPathTitles?: string;
};

/** Location kinds that open the cultural focus drawer. */
export const FOCUSABLE_LOCATION_KINDS: LocationKind[] = [
  "continent",
  "city",
  "district",
  "neighborhood",
  "venue",
];

/** Cultural layers shown in the focus drawer (environment is scoped in center panel). */
export const FOCUS_CULTURAL_LAYERS: CivilizationStackLayer[] = [
  "species",
  "government",
  "beliefs",
  "fauna",
  "flora_food",
];

/** Location kinds that show environment stack in the center panel. */
export const ENVIRONMENT_LOCATION_KINDS: LocationKind[] = [
  "universe",
  "galaxy",
  "solar_system",
  "planet",
  "continent",
];

export function isFocusableLocationKind(kind: LocationKind): boolean {
  return FOCUSABLE_LOCATION_KINDS.includes(kind);
}

export function isEnvironmentLocationKind(kind: LocationKind): boolean {
  return ENVIRONMENT_LOCATION_KINDS.includes(kind);
}

export type WorldBuildStateV2 = {
  version: 2;
  storyScope: StoryScope | null;
  locations: LocationNode[];
  stackEntries: StackEntry[];
  activeLocationId: string | null;
  /** Focus drawer context — continent or city/setting node id. */
  activeEntityContext: string | null;
  universalLedger?: Record<string, string>;
  selectionId: string | null;
};

/** @deprecated v1 — use WorldBuildStateV2 */
export type WorldBuildStateV1 = {
  blocks?: unknown[];
  selectionId: string | null;
};

export function defaultWorldBuildStateV2(): WorldBuildStateV2 {
  return {
    version: 2,
    storyScope: null,
    locations: [],
    stackEntries: [],
    activeLocationId: null,
    activeEntityContext: null,
    universalLedger: {},
    selectionId: null,
  };
}

export function createLocationNode(
  kind: LocationKind,
  title: string,
  parentId: string | null = null,
  extra?: Partial<LocationNode>
): LocationNode {
  return {
    id: createId(),
    parentId,
    kind,
    title,
    ...extra,
  };
}

export function createStackEntry(
  locationId: string,
  layer: CivilizationStackLayer,
  parentTitle: string,
  title = "New entry",
  extra?: Pick<StackEntry, "contextPathTags" | "stampedPathTitles" | "authorTags">
): StackEntry {
  const authorTags = [...(extra?.authorTags ?? [])];
  for (const t of extra?.contextPathTags ?? []) {
    if (!authorTags.includes(t)) authorTags.push(t);
  }
  return {
    id: createId(),
    title,
    locationId,
    layer,
    stampedParentTitle: parentTitle,
    stampedPathTitles: extra?.stampedPathTitles,
    contextPathTags: extra?.contextPathTags,
    authorTags: authorTags.length ? authorTags : undefined,
    blockInputMode: "outline" as BlockInputMode,
    outlineFields: {},
  };
}

export const CIVILIZATION_STACK_LAYER_ORDER: CivilizationStackLayer[] = [
  "environment",
  "species",
  "government",
  "beliefs",
  "fauna",
  "flora_food",
];
