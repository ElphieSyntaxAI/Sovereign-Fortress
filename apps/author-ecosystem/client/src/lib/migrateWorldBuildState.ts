import { createId } from "./plotEngineTypes";
import type { LegacyWorldBuildState, WorldBlockEntity, WorldSectionId } from "./planningBlockTypes";
import type { CivilizationStackLayer, LocationKind, StoryScope, WorldBuildStateV2 } from "./worldBuildTypes";
import {
  createLocationNode,
  createStackEntry,
  defaultWorldBuildStateV2,
} from "./worldBuildTypes";
import { seedRootLocation } from "./worldLocationTree";

function layerForSection(section: WorldSectionId): CivilizationStackLayer {
  switch (section) {
    case "constants":
      return "environment";
    case "geography":
      return "environment";
    case "planet":
      return "environment";
    case "worldPersona":
      return "beliefs";
    case "stateLedger":
      return "environment";
    default:
      return "environment";
  }
}

function kindForSection(section: WorldSectionId): LocationKind {
  switch (section) {
    case "geography":
      return "solar_system";
    case "planet":
      return "planet";
    case "stateLedger":
      return "city";
    case "worldPersona":
      return "planet";
    default:
      return "planet";
  }
}

export function isWorldBuildStateV2(raw: unknown): raw is WorldBuildStateV2 {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as WorldBuildStateV2).version === 2 &&
    Array.isArray((raw as WorldBuildStateV2).locations) &&
    Array.isArray((raw as WorldBuildStateV2).stackEntries)
  );
}

export function migrateWorldBuildV1ToV2(v1: LegacyWorldBuildState): WorldBuildStateV2 {
  const base = defaultWorldBuildStateV2();
  const blocks = (v1.blocks ?? []) as WorldBlockEntity[];
  if (!blocks.length) {
    return { ...base, selectionId: v1.selectionId };
  }

  const storyScope: StoryScope = "global";
  const root = seedRootLocation(storyScope);
  const locations = [root];
  const stackEntries: WorldBuildStateV2["stackEntries"] = [];
  let universalLedger: Record<string, string> = { ...base.universalLedger };

  const planetLoc = createLocationNode("planet", "Migrated planet", root.id);
  locations.push(planetLoc);

  for (const block of blocks) {
    if (block.section === "constants") {
      universalLedger = { ...universalLedger, ...(block.outlineFields ?? {}) };
      if (block.freestyleDetails?.trim()) {
        universalLedger.physicsLaw = block.freestyleDetails;
      }
      continue;
    }

    const locKind = kindForSection(block.section);
    let targetLoc = locations.find((l) => l.kind === locKind && l.title === block.title);
    if (!targetLoc) {
      const parentId =
        locKind === "solar_system"
          ? root.id
          : locKind === "planet"
            ? root.id
            : planetLoc.id;
      targetLoc = createLocationNode(locKind, block.title, parentId, {
        id: block.id,
        wikiRef: block.wikiRef,
        authorTags: block.authorTags,
      });
      locations.push(targetLoc);
    }

    const layer = layerForSection(block.section);
    if (block.section === "worldPersona") {
      stackEntries.push({
        ...block,
        id: createId(),
        locationId: targetLoc.id,
        layer: "beliefs",
        stampedParentTitle: targetLoc.title,
        blockInputMode: block.blockInputMode ?? "freestyle",
      });
      continue;
    }

    stackEntries.push({
      ...block,
      locationId: targetLoc.id,
      layer,
      stampedParentTitle: targetLoc.title,
      blockInputMode: block.blockInputMode ?? "freestyle",
    });
  }

  const activeLocationId = planetLoc.id;

  return {
    version: 2,
    storyScope,
    locations,
    stackEntries,
    activeLocationId,
    activeEntityContext: null,
    universalLedger,
    selectionId: v1.selectionId,
  };
}

export function normalizeWorldBuildState(raw: unknown): WorldBuildStateV2 {
  if (isWorldBuildStateV2(raw)) {
    return {
      ...defaultWorldBuildStateV2(),
      ...raw,
      version: 2,
    };
  }
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as LegacyWorldBuildState).blocks)) {
    return migrateWorldBuildV1ToV2(raw as LegacyWorldBuildState);
  }
  return defaultWorldBuildStateV2();
}
