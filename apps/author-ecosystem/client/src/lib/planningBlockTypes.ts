import { createId } from "./plotEngineTypes";

export type { BlockInputMode } from "./plotEngineTypes";
export { createId };

export type WikiEntityRef = {
  chunkId: string;
  title: string;
  kind: string;
};

export const WIKI_REF_PREFIX = "wiki://chunk/";

export function formatWikiRef(ref: WikiEntityRef): string {
  return `${WIKI_REF_PREFIX}${ref.chunkId}|${encodeURIComponent(ref.title)}|${ref.kind}`;
}

export function parseWikiRef(value: string): WikiEntityRef | null {
  const raw = value.trim();
  if (!raw.startsWith(WIKI_REF_PREFIX)) return null;
  const rest = raw.slice(WIKI_REF_PREFIX.length);
  const pipe = rest.indexOf("|");
  if (pipe < 0) return { chunkId: rest, title: "", kind: "" };
  const chunkId = rest.slice(0, pipe);
  const tail = rest.slice(pipe + 1);
  const pipe2 = tail.indexOf("|");
  if (pipe2 < 0) {
    return { chunkId, title: decodeURIComponent(tail), kind: "" };
  }
  return {
    chunkId,
    title: decodeURIComponent(tail.slice(0, pipe2)),
    kind: tail.slice(pipe2 + 1),
  };
}

export function wikiRefDisplayTitle(value: string): string {
  const ref = parseWikiRef(value);
  if (ref?.title) return ref.title;
  if (ref?.chunkId) return `Wiki ${ref.chunkId.slice(0, 8)}…`;
  return value;
}

export type PlanningBlockEntity = {
  id: string;
  title: string;
  blockInputMode?: import("./plotEngineTypes").BlockInputMode;
  freestyleDetails?: string;
  containsSpoiler?: boolean;
  outlineFields?: Record<string, string>;
  /** Author-facing tags for discovery (not RAG machine tags). */
  authorTags?: string[];
  wikiRef?: WikiEntityRef;
};

export type CharacterDevState = {
  characters: PlanningBlockEntity[];
  selectionId: string | null;
};

export type WorldSectionId =
  | "constants"
  | "geography"
  | "planet"
  | "worldPersona"
  | "stateLedger";

import type { WorldBlockArchetypeId } from "./worldBlockArchetypes";

export type WorldBlockEntity = PlanningBlockEntity & {
  section: WorldSectionId;
  /** Planet-tab archetype preset (solar system, religion, etc.). */
  worldArchetype?: WorldBlockArchetypeId;
};

/** @deprecated v1 tabbed world build — migrated to WorldBuildStateV2 on load */
export type LegacyWorldBuildState = {
  blocks: WorldBlockEntity[];
  selectionId: string | null;
};

export type { WorldBuildStateV2 as WorldBuildState } from "./worldBuildTypes";
export type {
  StoryScope,
  LocationNode,
  LocationKind,
  StackEntry,
  CivilizationStackLayer,
} from "./worldBuildTypes";

export function createPlanningBlockEntity(
  title: string,
  extra?: Partial<PlanningBlockEntity>
): PlanningBlockEntity {
  return {
    id: createId(),
    title,
    blockInputMode: "freestyle",
    ...extra,
  };
}

export function createWorldBlock(
  title: string,
  section: WorldSectionId
): WorldBlockEntity {
  return { ...createPlanningBlockEntity(title), section };
}

export function defaultCharacterDevState(): CharacterDevState {
  return { characters: [], selectionId: null };
}

export { defaultWorldBuildStateV2 as defaultWorldBuildState } from "./worldBuildTypes";
