import type { RagOutlineField, RagOutlinePanelSchema } from "./plotEngineRagOutlineSchema";
import type { CivilizationStackLayer, LocationKind } from "./worldBuildTypes";
import { WORLD_CONSTANTS_SECTIONS } from "./planningBlockSchema";

function field(
  key: string,
  label: string,
  ragTag: string,
  opts?: Partial<RagOutlineField>
): RagOutlineField {
  return { key, label, ragTag, ...opts };
}

const ENVIRONMENT_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What is the physical feel of this place?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.1",
      title: "Cosmic & universal constants",
      fields: [
        field("cosmic_physics", "Cosmic physics & FTL rules", "Universe_Phys", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Speed of light cap, wormhole gates, magic density…",
        }),
        field("galactic_climate", "Galactic climate bands", "Galaxy_Climate", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
    {
      sectionPath: "1.3.1.1",
      title: "Solar system environment",
      fields: [
        field("star_type", "Star type & sun(s)", "System_Star", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Red dwarf, binary pair, triple sun…",
        }),
        field("star_luminosity", "Luminosity & radiation", "System_Star: Luminosity", {
          placeholder: "Dim, flare-prone, stable G-type…",
        }),
        field("tidal_lock", "Tidal lock & orbital resonance", "System_Tidal_Lock", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Inner planet tidally locked, 3:2 spin-orbit…",
        }),
        field("orbital_mechanics", "Orbital mechanics & hazards", "System_Orbit", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Asteroid belts, rogue planets, lagrange stations…",
        }),
      ],
    },
    {
      sectionPath: "1.3.1.2",
      title: "Planetary environment",
      fields: [
        field("planet_phys", "Gravity & atmosphere", "Planet_Phys", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("planet_weather", "Climate & weather", "Planet_Weather: Type", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("planet_tidal_lock", "Planetary tidal lock", "Planet_Tidal_Lock", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Permanent day/night hemispheres…",
        }),
        field("day_length", "Day length & seasons", "Planet_Day_Season", {
          placeholder: "42-hour days, extreme axial tilt…",
        }),
        field("micro_climate", "Micro-climate here", "Spatial_Env: Micro_Climate", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const ENVIRONMENT_FIELDS_BY_KIND: Record<LocationKind, string[]> = {
  universe: ["cosmic_physics"],
  galaxy: ["cosmic_physics", "galactic_climate"],
  solar_system: ["star_type", "star_luminosity", "tidal_lock", "orbital_mechanics"],
  planet: ["planet_phys", "planet_weather", "planet_tidal_lock", "day_length"],
  continent: ["micro_climate"],
  city: ["micro_climate"],
  district: ["micro_climate"],
  neighborhood: ["micro_climate"],
  venue: ["micro_climate"],
};

export function getEnvironmentSchemaForKind(kind: LocationKind): RagOutlinePanelSchema {
  const allowed = new Set(ENVIRONMENT_FIELDS_BY_KIND[kind] ?? []);
  const sections = ENVIRONMENT_SCHEMA.sections
    ?.map((sec) => ({
      ...sec,
      fields: sec.fields?.filter((f) => allowed.has(f.key)),
    }))
    .filter((sec) => (sec.fields?.length ?? 0) > 0);
  return {
    ...ENVIRONMENT_SCHEMA,
    guidingQuestion:
      kind === "universe" || kind === "galaxy"
        ? "What cosmic rules govern this scope?"
        : kind === "solar_system"
          ? "Stars, tidal lock, and system-wide physics"
          : kind === "planet"
            ? "Planetary environment & orbital conditions"
            : "Local micro-climate and conditions",
    sections: sections ?? [],
  };
}

const HISTORY_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What happened here — and what do people remember?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.2",
      title: "History & memory",
      fields: [
        field("founding_event", "Founding or origin event", "History: Founding", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("timeline_note", "Timeline & eras", "History: Timeline", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("collective_memory", "Collective memory & myths", "History: Memory", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const GOVERNMENT_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "Who makes the rules — from treaties down to street gangs?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.3",
      title: "Governance & law",
      fields: [
        field("system_law", "System-wide law or treaty", "System_Law", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("local_authority", "Local authority", "Spatial_Law: Local_Auth", {
          placeholder: "City council, guild, warlord…",
        }),
        field("local_bans", "Local prohibitions", "Spatial_Law: Local_Bans", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("street_rules", "Street-level rules", "Spatial_Law: Gang_Rules", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const SCIENCE_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What technology, medicine, and knowledge define this place?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.3.1",
      title: "Science & technology",
      fields: [
        field("tech_level", "Technology level", "Science: Tech_Level", {
          placeholder: "Industrial, post-scarcity, retro-futurist…",
        }),
        field("breakthrough", "Key breakthrough or constraint", "Science: Breakthrough", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("medicine_note", "Medicine & biology", "Science: Medicine", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const RELIGION_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What do people believe — and how does faith shape daily life?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.4",
      title: "Religion & philosophy",
      fields: [
        field("religion_name", "Religion or philosophy", "Religion: Name", {
          placeholder: "The Twin Suns, the Deep Current…",
        }),
        field("sacred_object", "Sacred objects", "Religion: Sacred_Object", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("great_sin", "Great sin or taboo", "Religion: The_Great_Sin", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const CULTURAL_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "Language, customs, species, and everyday culture",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.5",
      title: "Culture & language",
      fields: [
        field("languages", "Languages & dialects", "Culture: Language", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("species_name", "Species or people group", "Bio: Species_Name", {
          placeholder: "Aethari, uplifts, refugees…",
        }),
        field("species_traits", "Traits & biology", "Bio: Species_Traits", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("sub_faction", "Sub-faction or clan", "Faction: Name", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("value_system", "Cultural values & customs", "Culture: Value_System", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("arts_note", "Arts, music, fashion", "Culture: Arts", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const FOOD_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What do people eat and drink here?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.5.1",
      title: "Food & diet",
      fields: [
        field("global_diet", "Typical diet", "Culture: Global_Diet", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Salt fish, kelp bread, spiced broth…",
        }),
        field("local_food", "Local specialty", "Spatial_Culture: Food", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("drink_note", "Drinks & intoxicants", "Culture: Drink", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

const FAUNA_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What wild life shapes the ecosystem?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.4",
      title: "Fauna & wild ecosystems",
      fields: [
        field("fauna_profile", "Fauna profile", "Flora/Fauna Profile", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("local_creature", "Creature found here", "Spatial_Bio", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("ecosystem_note", "Ecosystem notes", "Spatial_Bio: Ecosystem", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
  supportsSpoiler: true,
};

const FLORA_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What grows here — plants, fungi, and cultivated flora",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.4.1",
      title: "Flora & vegetation",
      fields: [
        field("staple_crop", "Staple flora & crops", "Flora: Staple", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("native_plants", "Native plants & fungi", "Flora: Native", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("dangerous_flora", "Toxic or invasive species", "Flora: Hazard", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

export const CIVILIZATION_STACK_SCHEMAS: Record<CivilizationStackLayer, RagOutlinePanelSchema> = {
  environment: ENVIRONMENT_SCHEMA,
  fauna: FAUNA_SCHEMA,
  flora: FLORA_SCHEMA,
  history: HISTORY_SCHEMA,
  government: GOVERNMENT_SCHEMA,
  science: SCIENCE_SCHEMA,
  religion: RELIGION_SCHEMA,
  cultural: CULTURAL_SCHEMA,
  food: FOOD_SCHEMA,
};

export const CIVILIZATION_STACK_LAYER_META: Record<
  CivilizationStackLayer,
  { title: string; emoji: string; hint?: string }
> = {
  environment: {
    title: "Environmental conditions",
    emoji: "🌡️",
    hint: "Suns, tidal lock, gravity, climate, and micro-climates.",
  },
  fauna: {
    title: "Fauna & animals",
    emoji: "🐺",
  },
  flora: {
    title: "Flora & vegetation",
    emoji: "🌿",
  },
  history: {
    title: "History & memory",
    emoji: "📜",
  },
  government: {
    title: "Government & law",
    emoji: "🏛️",
  },
  science: {
    title: "Science & technology",
    emoji: "🔬",
  },
  religion: {
    title: "Religion & philosophy",
    emoji: "🛐",
  },
  cultural: {
    title: "Culture & language",
    emoji: "🎭",
    hint: "Languages, species, factions, customs, and arts.",
  },
  food: {
    title: "Food & diet",
    emoji: "🍲",
  },
};

export function getStackLayerSchema(layer: CivilizationStackLayer): RagOutlinePanelSchema {
  return CIVILIZATION_STACK_SCHEMAS[layer];
}

export const UNIVERSAL_LEDGER_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "Immutable laws — physics, magic, and universal rules.",
  tagGroup: "RAG TAG",
  ledgerTitle: "1.0 The static ledger",
  sections: WORLD_CONSTANTS_SECTIONS,
};
