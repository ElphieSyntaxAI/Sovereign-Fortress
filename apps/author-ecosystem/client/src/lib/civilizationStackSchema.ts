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

const ENVIRONMENT_SCHEMA_BY_KIND: Record<LocationKind, RagOutlinePanelSchema> = {
  universe: {
    guidingQuestion: "What laws govern this universe?",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1",
        title: "Universal constants",
        fields: [
          field("cosmic_physics", "Fundamental physics & FTL", "Universe_Phys", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Speed of light, magic density, causality rules…",
          }),
          field("universe_age", "Age & scale", "Universe: Age_Scale", {
            placeholder: "13B years, pocket universe, cyclic…",
          }),
        ],
      },
    ],
  },
  galaxy: {
    guidingQuestion: "What defines this galaxy?",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1",
        title: "Galactic structure",
        fields: [
          field("galaxy_type", "Galaxy type & shape", "Galaxy: Type", {
            placeholder: "Barred spiral, elliptical, irregular…",
          }),
          field("galactic_climate", "Radiation & star density", "Galaxy_Climate", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Core radiation, habitable zone band, nebula lanes…",
          }),
          field("galactic_center", "Core & supermassive object", "Galaxy: Core", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Active galactic nucleus, black hole, ancient construct…",
          }),
        ],
      },
    ],
  },
  solar_system: {
    guidingQuestion: "What makes this solar system unique?",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.1",
        title: "Star(s) & light",
        fields: [
          field("star_type", "Star type & sun(s)", "System_Star", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Red dwarf, binary pair, pulsar…",
          }),
          field("star_luminosity", "Luminosity & radiation", "System_Star: Luminosity", {
            placeholder: "Dim, flare-prone, stable G-type…",
          }),
          field("system_sky", "Sky appearance from habitable zone", "System_Sky", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Twin suns, violet dawn, permanent twilight…",
          }),
        ],
      },
      {
        sectionPath: "1.3.1.2",
        title: "Bodies & orbits",
        fields: [
          field("planet_catalog", "Planets & major bodies", "System: Planets", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Rocky inner, gas giant at 5 AU, ice dwarf belt…",
          }),
          field("moons", "Notable moons & stations", "System: Moons", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Titan-like moon, hollow orbital habitat…",
          }),
          field("orbital_mechanics", "Orbital mechanics & hazards", "System_Orbit", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Asteroid belt, Lagrange colonies, comet showers…",
          }),
        ],
      },
    ],
  },
  planet: {
    guidingQuestion: "What makes this planet physically distinct?",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.2",
        title: "Planetary physics",
        fields: [
          field("planet_gravity", "Gravity & mass", "Planet: Gravity", {
            placeholder: "0.8 g, super-Earth, low-G archipelago world…",
          }),
          field("planet_phys", "Atmosphere & pressure", "Planet_Phys", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Thin CO₂, breathable nitrogen-oxygen, toxic haze…",
          }),
          field("planet_tidal_lock", "Tidal lock", "Planet_Tidal_Lock", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Fully locked — eternal day side / night side…",
          }),
          field("day_length", "Day length, axial tilt & seasons", "Planet_Day_Season", {
            multiline: true,
            fieldType: "textarea",
          }),
        ],
      },
      {
        sectionPath: "1.3.1.3",
        title: "Sky & surface phenomena",
        fields: [
          field("aurora", "Aurora & magnetosphere", "Planet: Aurora", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Permanent aurora belt, crimson curtains at poles…",
          }),
          field("planet_weather", "Climate & weather", "Planet_Weather: Type", {
            multiline: true,
            fieldType: "textarea",
          }),
          field("planet_moons", "Moons visible from surface", "Planet: Moons", {
            multiline: true,
            fieldType: "textarea",
          }),
        ],
      },
    ],
  },
  continent: {
    guidingQuestion: "Regional terrain and climate",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.4",
        title: "Continental environment",
        fields: [
          field("terrain", "Terrain & landforms", "Spatial_Env: Terrain", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Volcanic arc, salt flats, megafauna jungle…",
          }),
          field("micro_climate", "Regional climate", "Spatial_Env: Micro_Climate", {
            multiline: true,
            fieldType: "textarea",
          }),
        ],
      },
    ],
  },
  city: {
    guidingQuestion: "Local setting conditions",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.5",
        title: "Setting environment",
        fields: [
          field("micro_climate", "Micro-climate & weather here", "Spatial_Env: Micro_Climate", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Humid docks, acid rain district, dome-controlled…",
          }),
          field("local_sky", "Sky & light at this setting", "Spatial_Env: Sky", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Neon haze, twin moons over rooftops…",
          }),
        ],
      },
    ],
  },
  district: {
    guidingQuestion: "District-level environment",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.5",
        title: "District conditions",
        fields: [
          field("micro_climate", "Micro-climate here", "Spatial_Env: Micro_Climate", {
            multiline: true,
            fieldType: "textarea",
          }),
          field("local_sky", "Light & atmosphere", "Spatial_Env: Sky", {
            multiline: true,
            fieldType: "textarea",
          }),
        ],
      },
    ],
  },
  neighborhood: {
    guidingQuestion: "Neighborhood environment",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.5",
        title: "Neighborhood conditions",
        fields: [
          field("micro_climate", "Micro-climate here", "Spatial_Env: Micro_Climate", {
            multiline: true,
            fieldType: "textarea",
          }),
        ],
      },
    ],
  },
  venue: {
    guidingQuestion: "Venue atmosphere",
    tagGroup: "RAG TAG",
    sections: [
      {
        sectionPath: "1.3.1.5",
        title: "Venue conditions",
        fields: [
          field("micro_climate", "Interior / local climate", "Spatial_Env: Micro_Climate", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Climate-controlled vault, open-air bazaar…",
          }),
        ],
      },
    ],
  },
};

/** Legacy combined schema — used as fallback for environment layer metadata. */
const ENVIRONMENT_SCHEMA: RagOutlinePanelSchema =
  ENVIRONMENT_SCHEMA_BY_KIND.planet;

export function getEnvironmentSchemaForKind(kind: LocationKind): RagOutlinePanelSchema {
  return ENVIRONMENT_SCHEMA_BY_KIND[kind] ?? ENVIRONMENT_SCHEMA_BY_KIND.planet;
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
    hint: "Tailored to this level — suns & moons at system scale; tidal lock & aurora on planets.",
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
