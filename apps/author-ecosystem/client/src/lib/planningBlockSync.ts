import { createId } from "./plotEngineTypes";
import { loadPlotEngineState, savePlotEngineState } from "./plotEngineStorage";
import {
  loadCharacterDevState,
  saveCharacterDevState,
  loadWorldBuildState,
  saveWorldBuildState,
} from "./planningBlockStorage";
import {
  createPlanningBlockEntity,
  formatWikiRef,
  type PlanningBlockEntity,
  type WikiEntityRef,
} from "./planningBlockTypes";
import { fetchWikiChunks, titleForWikiChunk } from "./wikiChunksClient";
import { composeSectionedWikiEntry, composeWikiEntry } from "./wikiEntityForms";
import { getOutlineLoreKindConfig } from "./outlineLoreKinds";
import { commitWikiEntry, updateWikiEntry } from "./wikiEntryClient";
import { CHARACTER_DEV_SCHEMA } from "./planningBlockSchema";
import { getStackLayerSchema } from "./civilizationStackSchema";
import { locationPathSlug } from "./worldLocationTree";
import { buildStackEntryRagLine, stackEntryWikiTags } from "./worldStackRag";
import type {
  CivilizationStackLayer,
  LocationNode,
  StackEntry,
  StoryScope,
  WorldBuildStateV2,
} from "./worldBuildTypes";
import { createLocationNode, createStackEntry, defaultWorldBuildStateV2 } from "./worldBuildTypes";

function excerptFromWikiContent(content: string): string {
  const lines = content.split("\n");
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("## ")) bodyStart = i + 1;
    if (lines[i]?.trim() === "" && bodyStart > 0) {
      bodyStart = i + 1;
      break;
    }
  }
  return (
    lines
      .slice(bodyStart)
      .filter((l) => !l.startsWith("**chunk_type:") && !l.startsWith("**tags:"))
      .join("\n")
      .trim() || content.trim()
  );
}

function wikiChunkToRef(id: string, content: string, meta?: Record<string, unknown>): WikiEntityRef {
  return {
    chunkId: id,
    title: titleForWikiChunk(content, meta),
    kind: String(meta?.outline_entity_kind ?? ""),
  };
}

function kindToLocationKind(meta: Record<string, unknown>): LocationNode["kind"] {
  const k = String(meta.location_kind ?? "city");
  const allowed: LocationNode["kind"][] = [
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
  return allowed.includes(k as LocationNode["kind"]) ? (k as LocationNode["kind"]) : "city";
}

function layerFromMeta(meta: Record<string, unknown>): CivilizationStackLayer {
  const l = String(meta.stack_layer ?? "environment");
  const allowed: CivilizationStackLayer[] = [
    "environment",
    "species",
    "government",
    "beliefs",
    "fauna",
    "flora_food",
  ];
  return allowed.includes(l as CivilizationStackLayer)
    ? (l as CivilizationStackLayer)
    : "environment";
}

function parseAuthorTagsFromMeta(meta: Record<string, unknown>): string[] {
  const raw = meta.author_tags;
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

/** Import character wiki chunks into character dev roster. */
export async function importCharactersFromWiki(manuscriptId: string): Promise<number> {
  const chunks = await fetchWikiChunks(manuscriptId);
  const chars = chunks.filter(
    (c) => String(c.metadata?.outline_entity_kind ?? "").toLowerCase() === "character"
  );
  if (!chars.length) return 0;

  const state = loadCharacterDevState(manuscriptId) ?? { characters: [], selectionId: null };
  const existingIds = new Set(state.characters.map((c) => c.wikiRef?.chunkId).filter(Boolean));
  let added = 0;

  for (const c of chars) {
    if (existingIds.has(c.id)) continue;
    const ref = wikiChunkToRef(c.id, c.content, c.metadata);
    const answers = c.metadata?.wiki_form_answers;
    const outlineFields =
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? Object.fromEntries(
            Object.entries(answers as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])
          )
        : undefined;
    state.characters.push({
      ...createPlanningBlockEntity(ref.title, {
        wikiRef: ref,
        freestyleDetails: excerptFromWikiContent(c.content).slice(0, 2000),
        blockInputMode: outlineFields ? "outline" : "freestyle",
        outlineFields,
        authorTags: parseAuthorTagsFromMeta(c.metadata ?? {}),
      }),
    });
    added++;
  }

  saveCharacterDevState(manuscriptId, state);
  return added;
}

/** Import world-bible wiki chunks into civilization stack v2 state. */
export async function importWorldFromWiki(manuscriptId: string): Promise<number> {
  const chunks = await fetchWikiChunks(manuscriptId);
  const world = chunks.filter((c) => {
    const kind = String(c.metadata?.outline_entity_kind ?? "").toLowerCase();
    const src = String(c.metadata?.source_type ?? "").toLowerCase();
    return kind === "environment" || kind === "setting" || src.includes("world_bible");
  });
  if (!world.length) return 0;

  const state = loadWorldBuildState(manuscriptId) ?? defaultWorldBuildStateV2();
  const existingChunkIds = new Set(
    state.stackEntries.map((e) => e.wikiRef?.chunkId).filter(Boolean)
  );
  let added = 0;

  for (const c of world) {
    if (existingChunkIds.has(c.id)) continue;
    const meta = c.metadata ?? {};
    const ref = wikiChunkToRef(c.id, c.content, meta);
    const answers = meta.wiki_form_answers;
    const outlineFields =
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? Object.fromEntries(
            Object.entries(answers as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])
          )
        : undefined;

    const locationId = String(meta.location_id ?? "");
    let loc = state.locations.find((l) => l.id === locationId);
    if (!loc) {
      const scope = (meta.story_scope as StoryScope) ?? state.storyScope ?? "global";
      if (!state.storyScope) state.storyScope = scope;
      loc = createLocationNode(
        kindToLocationKind(meta),
        ref.title,
        null,
        locationId ? { id: locationId } : undefined
      );
      state.locations.push(loc);
      if (!state.activeLocationId) state.activeLocationId = loc.id;
    }

    const layer = layerFromMeta(meta);
    const entry = createStackEntry(loc.id, layer, String(meta.stamped_parent ?? loc.title), ref.title);
    entry.wikiRef = ref;
    entry.outlineFields = outlineFields;
    entry.freestyleDetails = excerptFromWikiContent(c.content).slice(0, 2000);
    entry.blockInputMode = outlineFields ? "outline" : "freestyle";
    entry.authorTags = parseAuthorTagsFromMeta(meta);
    entry.stampedParentTitle = String(meta.stamped_parent ?? loc.title);

    state.stackEntries.push(entry);
    added++;
  }

  saveWorldBuildState(manuscriptId, state);
  return added;
}

/** Commit character block to wiki (create or update). */
export async function pushCharacterToWiki(
  manuscriptId: string,
  entity: PlanningBlockEntity
): Promise<WikiEntityRef> {
  const title = entity.title.trim();
  const answers =
    entity.blockInputMode === "outline"
      ? { ...(entity.outlineFields ?? {}) }
      : { freeform: entity.freestyleDetails ?? "" };

  const composed =
    entity.blockInputMode === "outline"
      ? composeSectionedWikiEntry({
          kind: "character",
          tier: "indepth",
          title,
          answers,
          panelSchema: CHARACTER_DEV_SCHEMA,
          authorTags: entity.authorTags,
        })
      : composeWikiEntry({
          kind: "character",
          tier: "general",
          title,
          answers,
        });

  const config = getOutlineLoreKindConfig("character");
  const payload = {
    title,
    excerpt: composed.excerpt,
    chunk_type: config.chunk_type,
    tags: composed.tags,
    wiki_metadata: composed.wiki_metadata,
  };

  if (entity.wikiRef?.chunkId) {
    await updateWikiEntry(manuscriptId, entity.wikiRef.chunkId, payload);
    return entity.wikiRef;
  }

  const res = (await commitWikiEntry(manuscriptId, payload)) as { chunk_id?: string; id?: string };
  const chunkId = String(res.chunk_id ?? res.id ?? "");
  return { chunkId, title, kind: "character" };
}

/** Commit civilization stack entry to wiki. */
export async function pushStackEntryToWiki(
  manuscriptId: string,
  entry: StackEntry,
  location: LocationNode,
  state: WorldBuildStateV2
): Promise<WikiEntityRef> {
  const title = entry.title.trim();
  const parentTitle = location.title;
  const storyScope = state.storyScope ?? "global";
  const pathSlug = locationPathSlug(location.id, state.locations);
  const panelSchema = getStackLayerSchema(entry.layer);

  const composed =
    entry.blockInputMode === "outline"
      ? composeSectionedWikiEntry({
          kind: "environment",
          tier: "indepth",
          title,
          answers: entry.outlineFields ?? {},
          panelSchema,
          authorTags: entry.authorTags,
        })
      : composeWikiEntry({
          kind: "environment",
          tier: "general",
          title,
          answers: { freeform: entry.freestyleDetails ?? "" },
        });

  const ragLine = buildStackEntryRagLine(entry, panelSchema, parentTitle);
  const excerpt = ragLine
    ? `${composed.excerpt}\n\n${ragLine}`.trim()
    : composed.excerpt;

  const config = getOutlineLoreKindConfig("environment");
  const payload = {
    title,
    excerpt,
    chunk_type: config.chunk_type,
    tags: [
      ...composed.tags,
      ...stackEntryWikiTags(entry, parentTitle, pathSlug, storyScope),
    ],
    wiki_metadata: {
      ...composed.wiki_metadata,
      source_type: "world_bible",
      outline_entity_kind: "environment",
      story_scope: storyScope,
      location_id: location.id,
      location_kind: location.kind,
      location_path: pathSlug,
      stack_layer: entry.layer,
      stamped_parent: parentTitle,
    },
  };

  if (entry.wikiRef?.chunkId) {
    await updateWikiEntry(manuscriptId, entry.wikiRef.chunkId, payload);
    return entry.wikiRef;
  }

  const res = (await commitWikiEntry(manuscriptId, payload)) as { chunk_id?: string; id?: string };
  const chunkId = String(res.chunk_id ?? res.id ?? "");
  return { chunkId, title, kind: "environment" };
}

/** @deprecated Use pushStackEntryToWiki */
export async function pushWorldBlockToWiki(
  manuscriptId: string,
  entry: StackEntry,
  location: LocationNode,
  state: WorldBuildStateV2
): Promise<WikiEntityRef> {
  return pushStackEntryToWiki(manuscriptId, entry, location, state);
}

/** Upsert character into plot engine global character pool. */
export function upsertCharacterToPlotPool(
  manuscriptId: string,
  entity: PlanningBlockEntity
): void {
  const state = loadPlotEngineState(manuscriptId);
  if (!state) return;

  const label = entity.title.trim();
  if (!label) return;

  const pool = state.globalRepos.character;
  const existing = entity.wikiRef?.chunkId
    ? pool.find((t) => t.wikiChunkId === entity.wikiRef?.chunkId)
    : pool.find((t) => t.label.toLowerCase() === label.toLowerCase());

  if (existing) {
    const idx = pool.indexOf(existing);
    pool[idx] = {
      ...existing,
      label,
      details: entity.freestyleDetails || existing.details,
      containsSpoiler: entity.containsSpoiler ?? existing.containsSpoiler,
      wikiChunkId: entity.wikiRef?.chunkId ?? existing.wikiChunkId,
      source: "wiki",
    };
  } else {
    pool.push({
      id: createId(),
      label,
      details: entity.freestyleDetails,
      containsSpoiler: entity.containsSpoiler,
      wikiChunkId: entity.wikiRef?.chunkId,
      source: entity.wikiRef ? "wiki" : "manual",
      outlineEntityKind: "character",
    });
  }

  state.globalRepos.character = pool;
  savePlotEngineState(manuscriptId, state);
}

/** Upsert stack entry into plot engine environmental pool. */
export function upsertStackEntryToPlotPool(
  manuscriptId: string,
  entry: StackEntry,
  locationTitle: string
): void {
  const state = loadPlotEngineState(manuscriptId);
  if (!state) return;

  if (entry.layer !== "environment" && entry.layer !== "fauna") return;

  const label = `${locationTitle}: ${entry.title}`.trim();
  if (!label) return;

  const details =
    entry.freestyleDetails ??
    Object.values(entry.outlineFields ?? {})
      .filter(Boolean)
      .join("\n");

  const pool = state.globalRepos.environmental;
  const existing = entry.wikiRef?.chunkId
    ? pool.find((t) => t.wikiChunkId === entry.wikiRef?.chunkId)
    : pool.find((t) => t.label.toLowerCase() === label.toLowerCase());

  if (existing) {
    const idx = pool.indexOf(existing);
    pool[idx] = {
      ...existing,
      label,
      details: details || existing.details,
      wikiChunkId: entry.wikiRef?.chunkId ?? existing.wikiChunkId,
      containsSpoiler: entry.containsSpoiler ?? existing.containsSpoiler,
      source: "wiki",
    };
  } else {
    pool.push({
      id: createId(),
      label,
      details,
      containsSpoiler: entry.containsSpoiler,
      wikiChunkId: entry.wikiRef?.chunkId,
      source: entry.wikiRef ? "wiki" : "manual",
      outlineEntityKind: "environment",
    });
  }

  state.globalRepos.environmental = pool;
  savePlotEngineState(manuscriptId, state);
}

/** @deprecated Use upsertStackEntryToPlotPool */
export function upsertWorldBlockToPlotPool(
  manuscriptId: string,
  entry: StackEntry,
  locationTitle: string
): void {
  upsertStackEntryToPlotPool(manuscriptId, entry, locationTitle);
}

/** When picking wiki in outline scene, fill link field and bind token. */
export function applyWikiRefToPlotOutline(
  manuscriptId: string,
  ref: WikiEntityRef,
  panel: "character" | "environmental" | "settings"
): string {
  upsertCharacterToPlotPool(manuscriptId, {
    id: createId(),
    title: ref.title,
    wikiRef: ref,
    blockInputMode: "freestyle",
  });
  return formatWikiRef(ref);
}

export function entityOutlineFieldsFromFreestyle(entity: PlanningBlockEntity): Record<string, string> {
  const fields: Record<string, string> = { ...(entity.outlineFields ?? {}) };
  if (entity.title) fields.characterName = entity.title;
  if (entity.wikiRef) {
    fields.characterSheetLink = formatWikiRef(entity.wikiRef);
  }
  if (entity.freestyleDetails && !fields.who) fields.who = entity.freestyleDetails;
  return fields;
}

export { CHARACTER_DEV_SCHEMA };
