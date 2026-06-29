import {
  defaultCharacterDevState,
  type CharacterDevState,
} from "./planningBlockTypes";
import { normalizeWorldBuildState } from "./migrateWorldBuildState";
import type { WorldBuildStateV2 } from "./worldBuildTypes";
import { defaultWorldBuildStateV2 } from "./worldBuildTypes";

const CHAR_PREFIX = "elphie:character-dev:";
const WORLD_PREFIX = "elphie:world-build:";

export function loadCharacterDevState(manuscriptId: string): CharacterDevState | null {
  if (!manuscriptId.trim()) return null;
  try {
    const raw = localStorage.getItem(`${CHAR_PREFIX}${manuscriptId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CharacterDevState;
    if (!parsed || !Array.isArray(parsed.characters)) return null;
    return { ...defaultCharacterDevState(), ...parsed };
  } catch {
    return null;
  }
}

export function saveCharacterDevState(manuscriptId: string, state: CharacterDevState): void {
  if (!manuscriptId.trim()) return;
  try {
    localStorage.setItem(`${CHAR_PREFIX}${manuscriptId}`, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function loadWorldBuildState(manuscriptId: string): WorldBuildStateV2 | null {
  if (!manuscriptId.trim()) return null;
  try {
    const raw = localStorage.getItem(`${WORLD_PREFIX}${manuscriptId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeWorldBuildState(parsed);
  } catch {
    return null;
  }
}

export function saveWorldBuildState(manuscriptId: string, state: WorldBuildStateV2): void {
  if (!manuscriptId.trim()) return;
  try {
    localStorage.setItem(`${WORLD_PREFIX}${manuscriptId}`, JSON.stringify({ ...state, version: 2 }));
  } catch {
    /* quota */
  }
}

export function defaultWorldBuildState(): WorldBuildStateV2 {
  return defaultWorldBuildStateV2();
}
