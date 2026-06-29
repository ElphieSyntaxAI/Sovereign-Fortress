import type { LocationKind, LocationNode, StoryScope } from "./worldBuildTypes";
import { createLocationNode } from "./worldBuildTypes";

const SCOPE_ROOT_KIND: Record<StoryScope, LocationKind> = {
  local: "city",
  global: "solar_system",
  universe: "universe",
};

const SCOPE_CHAINS: Record<StoryScope, LocationKind[]> = {
  universe: [
    "universe",
    "galaxy",
    "solar_system",
    "planet",
    "continent",
    "city",
    "district",
    "neighborhood",
    "venue",
  ],
  global: ["solar_system", "planet", "continent", "city", "district", "neighborhood", "venue"],
  local: ["city", "district", "neighborhood", "venue"],
};

const ROOT_DEFAULT_TITLES: Record<StoryScope, string> = {
  local: "My city",
  global: "My solar system",
  universe: "My universe",
};

const KIND_LABELS: Record<LocationKind, string> = {
  universe: "Universe",
  galaxy: "Galaxy",
  solar_system: "Solar system",
  planet: "Planet",
  continent: "Continent",
  city: "City / setting",
  district: "District",
  neighborhood: "Neighborhood",
  venue: "Building / venue",
};

const CHILD_DEFAULT_TITLES: Partial<Record<LocationKind, string>> = {
  universe: "New universe",
  galaxy: "New galaxy",
  solar_system: "New solar system",
  planet: "New planet",
  continent: "New continent",
  city: "New city",
  district: "New district",
  neighborhood: "New neighborhood",
  venue: "New venue",
};

export function getRootKindForScope(scope: StoryScope): LocationKind {
  return SCOPE_ROOT_KIND[scope];
}

export function getVisibleTreeKinds(scope: StoryScope): LocationKind[] {
  return SCOPE_CHAINS[scope];
}

export function isKindVisibleInScope(kind: LocationKind, scope: StoryScope): boolean {
  return SCOPE_CHAINS[scope].includes(kind);
}

export function getChildKinds(scope: StoryScope, parentKind: LocationKind): LocationKind[] {
  const chain = SCOPE_CHAINS[scope];
  const idx = chain.indexOf(parentKind);
  if (idx < 0 || idx >= chain.length - 1) return [];
  return [chain[idx + 1]];
}

export function isLocationVisibleInScope(node: LocationNode, scope: StoryScope): boolean {
  return isKindVisibleInScope(node.kind, scope);
}

export function filterVisibleLocations(
  locations: LocationNode[],
  scope: StoryScope
): LocationNode[] {
  return locations.filter((loc) => isLocationVisibleInScope(loc, scope));
}

export function seedRootLocation(scope: StoryScope): LocationNode {
  const kind = getRootKindForScope(scope);
  return createLocationNode(kind, ROOT_DEFAULT_TITLES[scope], null);
}

/** Title for a new top-level location (second universe, solar system, city, etc.). */
export function defaultTitleForNewRoot(
  scope: StoryScope,
  locations: LocationNode[]
): string {
  const kind = getRootKindForScope(scope);
  const rootCount = locations.filter(
    (l) => l.parentId === null && l.kind === kind
  ).length;
  if (rootCount === 0) return ROOT_DEFAULT_TITLES[scope];
  return defaultTitleForChildKind(kind);
}

/** Root-level nodes visible for the current scope (siblings at parentId null). */
export function getRootLocations(locations: LocationNode[], scope: StoryScope): LocationNode[] {
  return getLocationChildren(null, locations, scope);
}

export function defaultTitleForChildKind(kind: LocationKind): string {
  return CHILD_DEFAULT_TITLES[kind] ?? `New ${KIND_LABELS[kind].toLowerCase()}`;
}

export function kindLabel(kind: LocationKind): string {
  return KIND_LABELS[kind];
}

export function buildLocationPath(
  locationId: string,
  locations: LocationNode[]
): LocationNode[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const path: LocationNode[] = [];
  let cur = byId.get(locationId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

export function locationPathString(locationId: string, locations: LocationNode[]): string {
  return buildLocationPath(locationId, locations)
    .map((n) => n.title)
    .join(" › ");
}

export function locationPathSlug(locationId: string, locations: LocationNode[]): string {
  return buildLocationPath(locationId, locations)
    .map((n) => n.kind)
    .join("/");
}

/** Build tree children for sidebar (only visible nodes). */
export function getLocationChildren(
  parentId: string | null,
  locations: LocationNode[],
  scope: StoryScope
): LocationNode[] {
  return filterVisibleLocations(locations, scope).filter((l) => l.parentId === parentId);
}
