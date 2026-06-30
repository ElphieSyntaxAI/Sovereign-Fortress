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

/** Ecology layers (center panel) vs cultural layers (focus drawer). */
export type CivilizationStackLayer =
  | "environment"
  | "fauna"
  | "flora"
  | "history"
  | "government"
  | "science"
  | "religion"
  | "cultural"
  | "food";

/** @deprecated — migrated on load */
export type LegacyStackLayer =
  | "species"
  | "beliefs"
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
  stampedParentTitle?: string;
  contextPathTags?: string[];
  stampedPathTitles?: string;
};

export const FOCUSABLE_LOCATION_KINDS: LocationKind[] = [
  "continent",
  "city",
  "district",
  "neighborhood",
  "venue",
];

/** Cultural / society layers in the focus drawer. */
export const FOCUS_CULTURAL_LAYERS: CivilizationStackLayer[] = [
  "history",
  "government",
  "science",
  "religion",
  "cultural",
  "food",
];

/** Physical ecology layers grouped in the center panel. */
export const ECOLOGY_STACK_LAYERS: CivilizationStackLayer[] = [
  "environment",
  "fauna",
  "flora",
];

/** Location kinds that show the ecology stack in the center panel. */
export const ECOLOGY_LOCATION_KINDS: LocationKind[] = [
  "universe",
  "galaxy",
  "solar_system",
  "planet",
  "continent",
  "city",
  "district",
  "neighborhood",
  "venue",
];

/** @deprecated use ECOLOGY_LOCATION_KINDS */
export const ENVIRONMENT_LOCATION_KINDS = ECOLOGY_LOCATION_KINDS;

export function isFocusableLocationKind(kind: LocationKind): boolean {
  return FOCUSABLE_LOCATION_KINDS.includes(kind);
}

export function isEcologyLocationKind(kind: LocationKind): boolean {
  return ECOLOGY_LOCATION_KINDS.includes(kind);
}

/** @deprecated */
export function isEnvironmentLocationKind(kind: LocationKind): boolean {
  return isEcologyLocationKind(kind);
}

const LEGACY_LAYER_MAP: Record<string, CivilizationStackLayer> = {
  species: "cultural",
  beliefs: "religion",
  flora_food: "flora",
};

export function normalizeStackLayer(raw: string): CivilizationStackLayer {
  const mapped = LEGACY_LAYER_MAP[raw];
  if (mapped) return mapped;
  const allowed: CivilizationStackLayer[] = [
    "environment",
    "fauna",
    "flora",
    "history",
    "government",
    "science",
    "religion",
    "cultural",
    "food",
  ];
  if (allowed.includes(raw as CivilizationStackLayer)) {
    return raw as CivilizationStackLayer;
  }
  return "environment";
}

export type WorldBuildStateV2 = {
  version: 2;
  storyScope: StoryScope | null;
  locations: LocationNode[];
  stackEntries: StackEntry[];
  activeLocationId: string | null;
  activeEntityContext: string | null;
  universalLedger?: Record<string, string>;
  selectionId: string | null;
};

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
  ...ECOLOGY_STACK_LAYERS,
  ...FOCUS_CULTURAL_LAYERS,
];
