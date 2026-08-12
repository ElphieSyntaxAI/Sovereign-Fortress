/**
 * Story foundation taxonomy — SSOT bridging:
 * - apps/author-ecosystem/docs/rag/* (World Bible, Outline, Character, Themes…)
 * - World builder LocationKind + CivilizationStackLayer
 * - Planning layers + outline lore kinds
 * - Ingest semantic_domain / stack_layer / location_kind metadata
 *
 * Ingest must emit fact cards for every foundation that shows up in planners or RAG templates.
 */

export type FoundationOutlineKind =
  | "character"
  | "setting"
  | "environment"
  | "plot_point"
  | "genre"
  | "theme"
  | "spoiler"
  | "note"
  | "chapter";

export type FoundationStackLayer =
  | "environment"
  | "fauna"
  | "flora"
  | "history"
  | "government"
  | "science"
  | "religion"
  | "cultural"
  | "food"
  | "magic"
  | "physics"
  | "military"
  | "economy"
  | "language";

export type FoundationLocationKind =
  | "universe"
  | "galaxy"
  | "solar_system"
  | "planet"
  | "continent"
  | "city"
  | "district"
  | "neighborhood"
  | "venue";

export type StoryFoundationDomain =
  | "character"
  | "setting"
  | "environment"
  | "planet"
  | "solar_system"
  | "geography"
  | "climate"
  | "physics"
  | "magic"
  | "technology"
  | "propulsion"
  | "history"
  | "government"
  | "law"
  | "religion"
  | "culture"
  | "species"
  | "fauna"
  | "flora"
  | "biology"
  | "food"
  | "economy"
  | "military"
  | "language"
  | "theme"
  | "genre"
  | "plot_point"
  | "spoiler"
  | "parallel_arc"
  | "trope"
  | "sensitivity"
  | "senses"
  | "spatial"
  | "other";

export type FoundationInference = {
  /** Planner / wiki rail kind */
  kind: FoundationOutlineKind;
  /** semantic_domain stored on wiki_metadata */
  domain: StoryFoundationDomain;
  /** World-builder civilization stack layer when applicable */
  stack_layer?: FoundationStackLayer;
  /** World-builder location kind when applicable */
  location_kind?: FoundationLocationKind;
  /** Plot engine pairing panel */
  panel: "character" | "settings" | "environmental" | "theme" | "breadcrumbs" | "genre";
  /** RAG template source_type hint */
  source_type?:
    | "world_bible"
    | "character_sheet"
    | "story_outline"
    | "theme_sheet"
    | "trope_sensitivity_sheet"
    | "parallel_arc_sheet"
    | "world_as_character";
  /** True → distill into entity fact cards (never one section dump) */
  distill: boolean;
};

type FoundationRule = {
  id: StoryFoundationDomain;
  /** Match heading / tab / path text */
  match: RegExp;
  inference: FoundationInference;
};

/**
 * Ordered rules — first match wins.
 * Covers RAG READY WORLD BIBLE §1.x foundations + outline/character/theme sheets + world builder layers.
 */
export const STORY_FOUNDATION_RULES: FoundationRule[] = [
  // —— Outline / plot foundations ——
  {
    id: "plot_point",
    match: /\b(plot[- ]?point|hook|inciting|midpoint|climax|resolution|beat sheet|act structure|outline)\b/i,
    inference: {
      kind: "plot_point",
      domain: "plot_point",
      panel: "breadcrumbs",
      source_type: "story_outline",
      distill: true,
    },
  },
  {
    id: "parallel_arc",
    match: /\b(parallel arc|side stor|spin[- ]?off|sequel)\b/i,
    inference: {
      kind: "plot_point",
      domain: "parallel_arc",
      panel: "breadcrumbs",
      source_type: "parallel_arc_sheet",
      distill: true,
    },
  },
  {
    id: "genre",
    match: /\b(genre|genre[- ]blend|reader expectation)\b/i,
    inference: {
      kind: "genre",
      domain: "genre",
      panel: "genre",
      source_type: "theme_sheet",
      distill: true,
    },
  },
  {
    id: "theme",
    match: /\b(themes?|thematic|moral question|central question|motifs?)\b/i,
    inference: {
      kind: "theme",
      domain: "theme",
      panel: "theme",
      source_type: "theme_sheet",
      distill: true,
    },
  },
  {
    id: "trope",
    match: /\b(trope|sensitivity|cultural rule|subversion)\b/i,
    inference: {
      kind: "theme",
      domain: "trope",
      panel: "theme",
      source_type: "trope_sensitivity_sheet",
      distill: true,
    },
  },
  {
    id: "spoiler",
    match: /\b(spoiler|hidden lore|secret twist)\b/i,
    inference: {
      kind: "spoiler",
      domain: "spoiler",
      panel: "breadcrumbs",
      source_type: "story_outline",
      distill: true,
    },
  },
  {
    id: "character",
    match: /\b(character|cast|dramatis|persona|protagonist|antagonist|terrestrial being)\b/i,
    inference: {
      kind: "character",
      domain: "character",
      panel: "character",
      source_type: "character_sheet",
      distill: true,
    },
  },

  // —— World Bible static ledger foundations ——
  {
    id: "physics",
    match: /\b(physics|universal law|laws? of nature|frost line|goldilocks|signal lag|orbital|gravity baseline|radiation)\b/i,
    inference: {
      kind: "environment",
      domain: "physics",
      stack_layer: "physics",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "magic",
    match: /\b(magic|soft magic|hard magic|mana|spell|arcane)\b/i,
    inference: {
      kind: "setting",
      domain: "magic",
      stack_layer: "magic",
      panel: "settings",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "technology",
    match: /\b(technolog(?:y|ies)?|propulsion|comm tech|sensor|medical baseline|drive system|ion|ftl|warp|ship.?drive)\b/i,
    inference: {
      kind: "setting",
      domain: "technology",
      stack_layer: "science",
      panel: "settings",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "propulsion",
    match: /\b(propulsion|drive system|sub[- ]?light|ftl gate)\b/i,
    inference: {
      kind: "setting",
      domain: "propulsion",
      stack_layer: "science",
      panel: "settings",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "religion",
    match: /\b(religion|faith|belief|church|temple|pantheon|deit(?:y|ies)?|sacred|profane|oath|clergy|ritual)\b/i,
    inference: {
      kind: "environment",
      domain: "religion",
      stack_layer: "religion",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "government",
    match: /\b(government|politic(?:s|al)?|treaty|jurisdiction|regime|faction|authority|enforcement|corruption)\b/i,
    inference: {
      kind: "environment",
      domain: "government",
      stack_layer: "government",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "law",
    match: /\b(law|justice|punishment|taboo|supreme mandate|being.?status)\b/i,
    inference: {
      kind: "environment",
      domain: "law",
      stack_layer: "government",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "history",
    match: /\b(history|timeline|prophecy|chronolog(?:y|ical)?|era\b|ancient|dynasty|epoch|collapse|catastrophe|the wound)\b/i,
    inference: {
      kind: "environment",
      domain: "history",
      stack_layer: "history",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "planet",
    match: /\b(planets?|worlds?|habitable|interplanetary data|planet list)\b/i,
    inference: {
      kind: "environment",
      domain: "planet",
      stack_layer: "environment",
      location_kind: "planet",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "solar_system",
    match: /\b(solar system|system geography|barycenter|system anchor|system diameter|system feature)\b/i,
    inference: {
      kind: "environment",
      domain: "solar_system",
      stack_layer: "environment",
      location_kind: "solar_system",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "geography",
    match: /\b(geography|biome|continent|weather|spatial|setting name|landmark|poi|district|neighborhood|venue|city)\b/i,
    inference: {
      kind: "setting",
      domain: "geography",
      stack_layer: "environment",
      location_kind: "city",
      panel: "settings",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "climate",
    match: /\b(climate|weather|micro[- ]?climate|atmosphere|hydrology|day.?night|circadian)\b/i,
    inference: {
      kind: "environment",
      domain: "climate",
      stack_layer: "environment",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "fauna",
    match: /\b(fauna|creature|animal|cryptid|xenobiology)\b/i,
    inference: {
      kind: "environment",
      domain: "fauna",
      stack_layer: "fauna",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "flora",
    match: /\b(flora|plant|vegetation)\b/i,
    inference: {
      kind: "environment",
      domain: "flora",
      stack_layer: "flora",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "species",
    match: /\b(species|biology|ecology|food chain|race\b|genome|lineage|ancestry|alien)\b/i,
    inference: {
      kind: "environment",
      domain: "species",
      stack_layer: "fauna",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "biology",
    match: /\b(biology|reproduction|growth cycle|sleep pattern)\b/i,
    inference: {
      kind: "environment",
      domain: "biology",
      stack_layer: "fauna",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "food",
    match: /\b(food|diet|cuisine|staple|meal)\b/i,
    inference: {
      kind: "environment",
      domain: "food",
      stack_layer: "food",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "culture",
    match: /\b(culture|etiquette|pastime|recreation|holiday|festival|slang|dialect|architecture|aesthetic|value system)\b/i,
    inference: {
      kind: "environment",
      domain: "culture",
      stack_layer: "cultural",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "economy",
    match: /\b(econom(?:y|ics)?|trade|currency|market)\b/i,
    inference: {
      kind: "environment",
      domain: "economy",
      stack_layer: "economy",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "military",
    match: /\b(military|war|weapon|defense|security level)\b/i,
    inference: {
      kind: "environment",
      domain: "military",
      stack_layer: "military",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "language",
    match: /\b(language|dialect|tongue|linguistics)\b/i,
    inference: {
      kind: "environment",
      domain: "language",
      stack_layer: "language",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "spatial",
    match: /\b(spatial|local environment|point of interest|under[- ]?city|sector)\b/i,
    inference: {
      kind: "setting",
      domain: "spatial",
      stack_layer: "environment",
      location_kind: "venue",
      panel: "settings",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "senses",
    match: /\b(senses?|see:|smell:|touch:|hear:|taste:)\b/i,
    inference: {
      kind: "environment",
      domain: "senses",
      stack_layer: "environment",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "setting",
    match: /\b(setting|location|place|venue|scene now)\b/i,
    inference: {
      kind: "setting",
      domain: "setting",
      stack_layer: "environment",
      location_kind: "venue",
      panel: "settings",
      source_type: "world_bible",
      distill: true,
    },
  },
  {
    id: "environment",
    match: /\b(environment|world bible|worldbuilding|lore)\b/i,
    inference: {
      kind: "environment",
      domain: "environment",
      stack_layer: "environment",
      panel: "environmental",
      source_type: "world_bible",
      distill: true,
    },
  },
];

/** Domains that must always distill (foundations of the story). */
export const FOUNDATION_DISTILL_DOMAINS: ReadonlySet<StoryFoundationDomain> = new Set(
  STORY_FOUNDATION_RULES.filter((r) => r.inference.distill).map((r) => r.id)
);

export function inferFoundationFromHeading(heading: string): FoundationInference {
  const h = heading.trim();
  if (!h) {
    return {
      kind: "environment",
      domain: "other",
      panel: "environmental",
      source_type: "world_bible",
      distill: false,
    };
  }
  for (const rule of STORY_FOUNDATION_RULES) {
    if (rule.match.test(h)) return { ...rule.inference };
  }
  return {
    kind: "environment",
    domain: "other",
    panel: "environmental",
    source_type: "world_bible",
    distill: false,
  };
}

export function isFoundationDomainHeading(heading: string): boolean {
  const inf = inferFoundationFromHeading(heading);
  return inf.distill || FOUNDATION_DISTILL_DOMAINS.has(inf.domain);
}

/** Pass-1 / slot hint list for the LLM — keep in sync with STORY_FOUNDATION_RULES. */
export const FOUNDATION_PASS1_KIND_LIST =
  "character|setting|item|faction|planet|religion|technology|other";

export const FOUNDATION_PASS1_DOMAIN_HINT =
  "Map every foundation that appears: physics, magic, history, solar_system, planet, technology, propulsion, government, law, religion, culture, fauna, flora, species, biology, food, climate, geography, spatial settings, characters, themes, plot points, tropes. One named entity per row; traits = atomic facts only.";

/**
 * Map RAG TAG name prefixes (from World Bible / Outline templates) → foundation inference.
 * Examples: "Physics Law: …", "Religion: Name", "Tech: Travel_Type", "Planet_Phys: Gravity"
 */
export function inferFoundationFromRagTagName(tagName: string): FoundationInference {
  const n = tagName.trim();
  const prefix = n.split(/[:|]/)[0]?.trim() || n;
  // Prefer prefix match against same rules
  const fromPrefix = inferFoundationFromHeading(prefix);
  if (fromPrefix.domain !== "other") return fromPrefix;

  const lower = n.toLowerCase();
  if (/^physics/.test(lower) || /frost_line|goldilocks|signal_lag|gravity/.test(lower)) {
    return inferFoundationFromHeading("physics");
  }
  if (/magic/.test(lower)) return inferFoundationFromHeading("magic");
  if (/^tech\b|travel_type|comm_method|drive_system|sensors|medical/.test(lower)) {
    return inferFoundationFromHeading("technology");
  }
  if (/^history|prophecy|the_wound/.test(lower)) return inferFoundationFromHeading("history");
  if (/^religion|sacred|profane/.test(lower)) return inferFoundationFromHeading("religion");
  if (/^culture|etiquette|festival|recreation|diet|fun/.test(lower)) {
    return inferFoundationFromHeading("culture");
  }
  if (/^law\b|supreme_mandate|punishment|enforcement|corruption|system_law|planet_law|spatial_law/.test(lower)) {
    return inferFoundationFromHeading("law");
  }
  if (/^planet_|system_geography|system_feature|system_scale/.test(lower)) {
    return inferFoundationFromHeading("planet");
  }
  if (/^bio\b|planet_bio|spatial_bio|food_chain/.test(lower)) {
    return inferFoundationFromHeading("biology");
  }
  if (/^spatial_/.test(lower)) return inferFoundationFromHeading("spatial");
  if (/character|link to character/.test(lower)) return inferFoundationFromHeading("character");
  if (/plot[- ]?point|era:/.test(lower)) return inferFoundationFromHeading("plot point");
  if (/spoiler/.test(lower)) return inferFoundationFromHeading("spoiler");
  if (/theme|environmental tag/.test(lower)) return inferFoundationFromHeading("theme");
  return fromPrefix;
}

/** Human-readable inventory of foundations (docs / status probes). */
export function listStoryFoundations(): Array<{
  domain: StoryFoundationDomain;
  kind: FoundationOutlineKind;
  stack_layer?: FoundationStackLayer;
  location_kind?: FoundationLocationKind;
}> {
  return STORY_FOUNDATION_RULES.map((r) => ({
    domain: r.id,
    kind: r.inference.kind,
    stack_layer: r.inference.stack_layer,
    location_kind: r.inference.location_kind,
  }));
}
