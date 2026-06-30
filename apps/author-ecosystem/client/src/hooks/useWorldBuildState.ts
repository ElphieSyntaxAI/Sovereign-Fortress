import { useCallback, useEffect, useMemo, useState } from "react";

import {
  loadWorldBuildState,
  saveWorldBuildState,
} from "../lib/planningBlockStorage";
import type { BlockInputMode } from "../lib/plotEngineTypes";
import {
  buildHierarchyContextTags,
  buildStampedPathTitles,
} from "../lib/worldStackRag";
import {
  buildLocationPath,
  defaultTitleForChildKind,
  defaultTitleForNewRoot,
  filterVisibleLocations,
  getChildKinds,
  getLocationChildren,
  getRootKindForScope,
  locationPathString,
  locationPathSlug,
  seedRootLocation,
} from "../lib/worldLocationTree";
import type {
  CivilizationStackLayer,
  LocationKind,
  LocationNode,
  StackEntry,
  StoryScope,
  WorldBuildStateV2,
} from "../lib/worldBuildTypes";
import {
  createLocationNode,
  createStackEntry,
  defaultWorldBuildStateV2,
  isFocusableLocationKind,
} from "../lib/worldBuildTypes";

function resolveEntityContext(
  locationId: string | null,
  locations: LocationNode[]
): string | null {
  if (!locationId) return null;
  const loc = locations.find((l) => l.id === locationId);
  if (!loc || !isFocusableLocationKind(loc.kind)) return null;
  return locationId;
}

export function useWorldBuildState(manuscriptId: string) {
  const [state, setState] = useState<WorldBuildStateV2>(() =>
    manuscriptId
      ? loadWorldBuildState(manuscriptId) ?? defaultWorldBuildStateV2()
      : defaultWorldBuildStateV2()
  );

  useEffect(() => {
    if (!manuscriptId) return;
    setState(loadWorldBuildState(manuscriptId) ?? defaultWorldBuildStateV2());
  }, [manuscriptId]);

  const persist = useCallback(
    (next: WorldBuildStateV2 | ((prev: WorldBuildStateV2) => WorldBuildStateV2)) => {
      setState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (manuscriptId) saveWorldBuildState(manuscriptId, resolved);
        return resolved;
      });
    },
    [manuscriptId]
  );

  const setStoryScope = useCallback(
    (scope: StoryScope) => {
      const next = { ...state, storyScope: scope };
      const visible = filterVisibleLocations(next.locations, scope);
      if (!visible.length) {
        const root = seedRootLocation(scope);
        next.locations = [...next.locations, root];
        next.activeLocationId = root.id;
        next.activeEntityContext = resolveEntityContext(root.id, next.locations);
      } else {
        if (
          !next.activeLocationId ||
          !visible.some((l) => l.id === next.activeLocationId)
        ) {
          next.activeLocationId = visible[0]?.id ?? null;
        }
        if (
          next.activeEntityContext &&
          !visible.some((l) => l.id === next.activeEntityContext)
        ) {
          next.activeEntityContext = null;
        } else if (next.activeLocationId) {
          next.activeEntityContext = resolveEntityContext(
            next.activeLocationId,
            next.locations
          );
        }
      }
      persist(next);
    },
    [state, persist]
  );

  const setActiveLocation = useCallback(
    (id: string | null) => {
      persist({
        ...state,
        activeLocationId: id,
        activeEntityContext: resolveEntityContext(id, state.locations),
        selectionId: null,
      });
    },
    [state, persist]
  );

  const clearEntityContext = useCallback(() => {
    persist({ ...state, activeEntityContext: null, selectionId: null });
  }, [state, persist]);

  const addLocation = useCallback(
    (parentId: string | null, kind: LocationKind, title?: string) => {
      let created: LocationNode | null = null;
      persist((prev) => {
        const node = createLocationNode(
          kind,
          title ?? defaultTitleForChildKind(kind),
          parentId
        );
        created = node;
        const nextLocations = [...prev.locations, node];
        return {
          ...prev,
          locations: nextLocations,
          activeLocationId: node.id,
          activeEntityContext: resolveEntityContext(node.id, nextLocations),
          selectionId: null,
        };
      });
      return created;
    },
    [persist]
  );

  const addRootLocation = useCallback(() => {
    let created: LocationNode | null = null;
    persist((prev) => {
      if (!prev.storyScope) return prev;
      const kind = getRootKindForScope(prev.storyScope);
      const title = defaultTitleForNewRoot(prev.storyScope, prev.locations);
      const node = createLocationNode(kind, title, null);
      created = node;
      const nextLocations = [...prev.locations, node];
      return {
        ...prev,
        locations: nextLocations,
        activeLocationId: node.id,
        activeEntityContext: resolveEntityContext(node.id, nextLocations),
        selectionId: null,
      };
    });
    return created;
  }, [persist]);

  const patchLocation = useCallback(
    (id: string, patch: Partial<LocationNode>) => {
      const nextLocations = state.locations.map((l) =>
        l.id === id ? { ...l, ...patch } : l
      );
      persist({
        ...state,
        locations: nextLocations,
      });
    },
    [state, persist]
  );

  const deleteLocation = useCallback(
    (id: string) => {
      const removeIds = new Set<string>();
      const collect = (locId: string) => {
        removeIds.add(locId);
        for (const child of state.locations.filter((l) => l.parentId === locId)) {
          collect(child.id);
        }
      };
      collect(id);
      persist({
        ...state,
        locations: state.locations.filter((l) => !removeIds.has(l.id)),
        stackEntries: state.stackEntries.filter((e) => !removeIds.has(e.locationId)),
        activeLocationId:
          state.activeLocationId && removeIds.has(state.activeLocationId)
            ? null
            : state.activeLocationId,
        activeEntityContext:
          state.activeEntityContext && removeIds.has(state.activeEntityContext)
            ? null
            : state.activeEntityContext,
        selectionId:
          state.selectionId &&
          state.stackEntries.find((e) => e.id === state.selectionId && removeIds.has(e.locationId))
            ? null
            : state.selectionId,
      });
    },
    [state, persist]
  );

  const addStackEntry = useCallback(
    (locationId: string, layer: CivilizationStackLayer, title?: string) => {
      const loc = state.locations.find((l) => l.id === locationId);
      if (!loc) return null;
      const path = buildLocationPath(locationId, state.locations);
      const contextPathTags = buildHierarchyContextTags(path);
      const stampedPathTitles = buildStampedPathTitles(path);
      const entry = createStackEntry(
        locationId,
        layer,
        loc.title,
        title ?? `New ${layer.replace("_", " ")}`,
        { contextPathTags, stampedPathTitles }
      );
      persist({
        ...state,
        stackEntries: [...state.stackEntries, entry],
        selectionId: entry.id,
      });
      return entry;
    },
    [state, persist]
  );

  const patchStackEntry = useCallback(
    (id: string, patch: Partial<StackEntry>) => {
      persist({
        ...state,
        stackEntries: state.stackEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      });
    },
    [state, persist]
  );

  const deleteStackEntry = useCallback(
    (id: string) => {
      persist({
        ...state,
        stackEntries: state.stackEntries.filter((e) => e.id !== id),
        selectionId: state.selectionId === id ? null : state.selectionId,
      });
    },
    [state, persist]
  );

  const setUniversalLedgerField = useCallback(
    (key: string, value: string) => {
      const ledger = { ...(state.universalLedger ?? {}) };
      if (value.trim()) ledger[key] = value;
      else delete ledger[key];
      persist({ ...state, universalLedger: ledger });
    },
    [state, persist]
  );

  const setSelectionId = useCallback(
    (id: string | null) => {
      persist({ ...state, selectionId: id });
    },
    [state, persist]
  );

  const visibleLocations = useMemo(
    () => (state.storyScope ? filterVisibleLocations(state.locations, state.storyScope) : []),
    [state.locations, state.storyScope]
  );

  const activeLocation = useMemo(
    () => state.locations.find((l) => l.id === state.activeLocationId) ?? null,
    [state.locations, state.activeLocationId]
  );

  const focusContextLocation = useMemo(
    () =>
      state.activeEntityContext
        ? state.locations.find((l) => l.id === state.activeEntityContext) ?? null
        : null,
    [state.locations, state.activeEntityContext]
  );

  const isFocusDrawerOpen = Boolean(state.activeEntityContext && focusContextLocation);

  const selectedEntry = useMemo(
    () => state.stackEntries.find((e) => e.id === state.selectionId) ?? null,
    [state.stackEntries, state.selectionId]
  );

  const entriesForActiveLocation = useMemo(
    () =>
      state.activeLocationId
        ? state.stackEntries.filter((e) => e.locationId === state.activeLocationId)
        : [],
    [state.stackEntries, state.activeLocationId]
  );

  const entriesForFocusContext = useMemo(
    () =>
      state.activeEntityContext
        ? state.stackEntries.filter((e) => e.locationId === state.activeEntityContext)
        : [],
    [state.stackEntries, state.activeEntityContext]
  );

  const focusBreadcrumb = useMemo(
    () =>
      state.activeEntityContext
        ? locationPathString(state.activeEntityContext, state.locations)
        : "",
    [state.activeEntityContext, state.locations]
  );

  const breadcrumb = useMemo(
    () =>
      state.activeLocationId
        ? locationPathString(state.activeLocationId, state.locations)
        : "",
    [state.activeLocationId, state.locations]
  );

  const activePathSlug = useMemo(
    () =>
      state.activeLocationId
        ? locationPathSlug(state.activeLocationId, state.locations)
        : "",
    [state.activeLocationId, state.locations]
  );

  const activePathNodes = useMemo(
    () =>
      state.activeLocationId
        ? buildLocationPath(state.activeLocationId, state.locations)
        : [],
    [state.activeLocationId, state.locations]
  );

  return {
    state,
    persist,
    setStoryScope,
    setActiveLocation,
    clearEntityContext,
    addLocation,
    addRootLocation,
    patchLocation,
    deleteLocation,
    addStackEntry,
    patchStackEntry,
    deleteStackEntry,
    setUniversalLedgerField,
    setSelectionId,
    visibleLocations,
    activeLocation,
    focusContextLocation,
    isFocusDrawerOpen,
    selectedEntry,
    entriesForActiveLocation,
    entriesForFocusContext,
    breadcrumb,
    focusBreadcrumb,
    activePathSlug,
    activePathNodes,
    getChildren: (parentId: string | null) =>
      state.storyScope
        ? getLocationChildren(parentId, state.locations, state.storyScope)
        : [],
    getChildKindsFor: (parentKind: LocationKind) =>
      state.storyScope ? getChildKinds(state.storyScope, parentKind) : [],
    patchUniversalLedger: (ledger: Record<string, string>) => {
      persist({ ...state, universalLedger: ledger });
    },
    setEntryMode: (id: string, mode: BlockInputMode) => patchStackEntry(id, { blockInputMode: mode }),
  };
}
