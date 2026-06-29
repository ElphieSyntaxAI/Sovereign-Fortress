import type { RagOutlineField, RagOutlinePanelSchema, RagOutlineSection } from "./plotEngineRagOutlineSchema";
import { buildPanelRagLineFromSchema } from "./plotEngineRagOutlineSchema";
import type { WorldSectionId } from "./planningBlockTypes";
import { mergePlanetArchetypeSections, type WorldBlockArchetypeId } from "./worldBlockArchetypes";

const STATIC_LEDGER_INSTRUCTION =
  'This section is "read-only" canon. Use it to flag logical errors in the manuscript—do not suggest casual changes to these entries.';

function field(
  key: string,
  label: string,
  ragTag: string,
  opts?: Partial<RagOutlineField>
): RagOutlineField {
  return { key, label, ragTag, ...opts };
}

export const CHARACTER_DEV_SECTIONS: RagOutlineSection[] = [
  {
    sectionPath: "1.0",
    title: "Static character ledger",
    aiInstruction: STATIC_LEDGER_INSTRUCTION,
    guidingQuestion: "Core canon for this character—the facts that should stay consistent.",
  },
  {
    sectionPath: "1.1",
    title: "Role in story",
    guidingQuestion: "What part do they play in your narrative?",
    fields: [
      field("role", "Role in the story", "Field: Role", {
        placeholder: "Protagonist, antagonist, supporting…",
      }),
      field("narrative_weight", "How important are they? (1–10)", "NARRATIVE_WEIGHT", {
        placeholder: "7",
      }),
    ],
  },
  {
    sectionPath: "1.2",
    title: "Visual identity",
    guidingQuestion: "How do they look?",
    sections: [
      {
        sectionPath: "1.2.1",
        title: "Overall appearance",
        fields: [
          field("visual_master", "Overall appearance", "Field: Visual_Identity", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Height, build, distinguishing features…",
          }),
          field("anatomy_face", "Face & head", "ANATOMY_NODES: Face", {
            placeholder: "Sharp jaw, heterochromia…",
          }),
          field("anatomy_body", "Body", "ANATOMY_NODES: Body", {
            placeholder: "Athletic, scarred arms…",
          }),
        ],
      },
      {
        sectionPath: "1.2.2",
        title: "Marks & style",
        fields: [
          field("modifier_tattoos", "Tattoos or body art", "Tattoos", {
            placeholder: "Yes — sleeve of constellations",
          }),
          field("modifier_scars", "Scars", "Scars", {
            placeholder: "Yes — scar across left cheek",
          }),
          field("modifier_cosmetic", "Hair, makeup, nails", "Cosmetic", {
            placeholder: "Cropped silver hair, kohl liner",
          }),
        ],
      },
    ],
  },
  {
    sectionPath: "1.3",
    title: "Essential stats",
    guidingQuestion: "Biology and power—what makes them capable or limited?",
    sections: [
      {
        sectionPath: "1.3.1",
        title: "Biological information",
        fields: [
          field("bio_age_species", "Age, species, gender", "Field: BIO", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "28, human, she/her",
          }),
        ],
      },
      {
        sectionPath: "1.3.2",
        title: "Power or ability",
        fields: [
          field("power_name_type_limits", "Power, type, and limits", "System: Power_Name", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Telepathy | Magic | Level 3 | Only works on touch",
          }),
        ],
      },
    ],
  },
  {
    sectionPath: "1.4",
    title: "Personality type",
    guidingQuestion: "How do they decide, react, and come across?",
    fields: [
      field("persona_logic", "How they decide", "Field: Persona_Logic", {
        placeholder: "INTJ, lawful neutral…",
      }),
      field("persona_emotion", "How they react", "Field: Persona_Emotion", {
        placeholder: "Enneagram 5w6…",
      }),
      field("persona_vibe", "How others experience them", "Field: Persona_vibe", {
        placeholder: "Reserved warmth, dry humor…",
      }),
    ],
  },
  {
    sectionPath: "1.5",
    title: "Style & speech",
    guidingQuestion: "What do they wear and how do they sound?",
    sections: [
      {
        sectionPath: "1.5.1",
        title: "Clothing & daily wear",
        fields: [
          field("daily_wear", "Typical outfit", "Daily wear", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Worn leather jacket, boots, no jewelry",
          }),
        ],
      },
      {
        sectionPath: "1.5.2",
        title: "Voice & mannerisms",
        fields: [
          field("catchphrases", "Catchphrases & verbal tics", "Speech mannerisms", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Says 'fair enough' when cornered",
          }),
          field("speech_mannerisms", "Dialect & speech patterns", "Speech mannerisms", {
            multiline: true,
            fieldType: "textarea",
          }),
          field("habits", "Habits & tics", "Habits", {
            multiline: true,
            fieldType: "textarea",
            placeholder: "Rubs thumb over ring when nervous",
          }),
        ],
      },
    ],
  },
  {
    sectionPath: "1.6",
    title: "Values & sentimental items",
    guidingQuestion: "What do they care about—and what do they reject?",
    fields: [
      field("values_important", "Three things they value most", "Values_Important values", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("values_distain", "Three things they hate about the world", "Values_Distain", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("values_struggles", "Personal struggles", "Values_Personal Struggles", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("sentimental_items", "Sentimental items", "Sentimental_Items", {
        multiline: true,
        fieldType: "textarea",
        placeholder: "Mother's compass, cracked photo…",
      }),
    ],
  },
  {
    sectionPath: "1.7",
    title: "Backstory & agenda",
    guidingQuestion: "Where they came from and what they believe in.",
    aiInstruction:
      "Backstory explains fears and skills; agenda shapes how they interpret new information.",
    fields: [
      field("backstory_nodes", "Key life events", "Backstory_Node", {
        multiline: true,
        fieldType: "textarea",
        placeholder: "Exile at 12, found family in the crew…",
      }),
      field("agenda", "Political & religious stance", "Agenda", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("hidden_secret", "Core secret", "Hidden_Data", {
        multiline: true,
        fieldType: "textarea",
        placeholder: "They are the lost heir…",
      }),
    ],
  },
  {
    sectionPath: "1.8",
    title: "Relationships",
    guidingQuestion: "Who lifts them up—and who tears them down?",
    fields: [
      field("relation_positive", "Positive relationships", "Relation_Positive", {
        multiline: true,
        fieldType: "textarea",
        placeholder: "Mira — mentor — trust",
      }),
      field("relation_negative", "Negative relationships", "Relation_Negative", {
        multiline: true,
        fieldType: "textarea",
      }),
    ],
  },
];

export const CHARACTER_DEV_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "Who is this character? Build their static ledger like your Character Sheet.",
  tagGroup: "RAG TAG",
  ledgerTitle: "1.0 Static Character Ledger",
  sections: CHARACTER_DEV_SECTIONS,
  supportsSpoiler: true,
};

export const WORLD_CONSTANTS_SECTIONS: RagOutlineSection[] = [
  {
    sectionPath: "1.0",
    title: "The static ledger",
    aiInstruction: STATIC_LEDGER_INSTRUCTION,
    guidingQuestion: "Immutable laws—the rules that never change no matter where you are.",
  },
  {
    sectionPath: "1.1.1",
    title: "Laws of physics",
    fields: [
      field("physicsLaw", "Physics law", "Physics Law", {
        placeholder: "Low gravity on outer stations",
        multiline: true,
        fieldType: "textarea",
      }),
    ],
  },
  {
    sectionPath: "1.1.2",
    title: "Magic system",
    fields: [
      field("softMagic", "Soft magic", "Soft Magic", { placeholder: "Law name or description" }),
      field("hardMagic", "Hard magic", "Hard Magic", { placeholder: "Law name or description" }),
      field("magicException", "Magic exception", "Hard or Soft Magic: Exception", {
        multiline: true,
        fieldType: "textarea",
      }),
    ],
  },
  {
    sectionPath: "1.1.3",
    title: "History",
    fields: [
      field("history_prophecy", "Prophecy or pivotal history", "History", {
        multiline: true,
        fieldType: "textarea",
        placeholder: "The Sundering — spoiler: medium",
      }),
    ],
  },
];

const WORLD_GEOGRAPHY_SECTIONS: RagOutlineSection[] = [
  {
    sectionPath: "1.2",
    title: "Solar system geography",
    guidingQuestion: "How is your star system laid out?",
    fields: [
      field("systemGeography", "System name & overview", "System_Geography", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("stellarMotion", "How the stars move", "Stellar_Motion", {
        placeholder: "Binary pair orbiting a barycenter…",
      }),
      field("systemScale", "Scale (AU)", "System_Scale", { placeholder: "42 AU frost line" }),
      field("systemFeature", "Notable system feature", "System_Feature", {
        placeholder: "Asteroid belt, rogue planet…",
      }),
    ],
  },
];

const WORLD_PERSONA_SECTIONS: RagOutlineSection[] = [
  {
    sectionPath: "1.4",
    title: "World as character",
    guidingQuestion: "If your world had a misbelief and a desire, what would they be?",
    fields: [
      field("worldMisbelief", "World misbelief", "World_Misbelief", {
        placeholder: "Progress always requires sacrifice",
      }),
      field("worldGoal", "What the world wants", "World_Goal"),
      field("globalMood", "Global mood", "Global_Mood", { placeholder: "Anxious optimism" }),
      field("worldLogicWeight", "Logic vs instinct (1–10)", "World_Logic_Weight", {
        placeholder: "6",
      }),
      field("worldObstacle", "Active antagonism", "World_Obstacle", {
        multiline: true,
        fieldType: "textarea",
        placeholder: "The dying sun, the empire's blockade…",
      }),
    ],
  },
];

const WORLD_STATE_SECTIONS: RagOutlineSection[] = [
  {
    sectionPath: "2.0",
    title: "Environmental state ledger",
    guidingQuestion: "Live world state—what is shifting right now in your story?",
    fields: [
      field("worldHp", "Planetary health", "World_HP", { placeholder: "Stable, declining…" }),
      field("tensionLevel", "Atmospheric tension", "Tension_Level", { placeholder: "High" }),
      field("resourceState", "Resource scarcity", "Resource_State", {
        placeholder: "Water rationing in the capital",
      }),
      field("exteriorForce", "Active exterior force", "Environmental tag", {
        multiline: true,
        fieldType: "textarea",
      }),
    ],
  },
];

export const WORLD_PLANET_BASE_SECTIONS: RagOutlineSection[] = [
  {
    sectionPath: "1.3",
    title: "Planetary profile",
    guidingQuestion: "Describe this world or region.",
    fields: [
      field("gravity_atmosphere", "Gravity & atmosphere", "Planet_Phys", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("biome", "Biome & geography", "Planet_Geo: Biome", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("exterior_force", "Active exterior forces", "Environmental tag", {
        multiline: true,
        fieldType: "textarea",
      }),
      field("culture_values", "Cultural values", "Culture: Value_System", {
        multiline: true,
        fieldType: "textarea",
      }),
    ],
  },
];

export const WORLD_SECTION_SCHEMAS: Record<
  WorldSectionId,
  { label: string; schema: RagOutlinePanelSchema }
> = {
  constants: {
    label: "Universal constants",
    schema: {
      guidingQuestion: "Immutable laws—physics, magic, and universal rules.",
      tagGroup: "RAG TAG",
      sections: WORLD_CONSTANTS_SECTIONS,
    },
  },
  geography: {
    label: "Geography & system scale",
    schema: {
      guidingQuestion: "System geography, orbital physics, and scale.",
      tagGroup: "RAG TAG",
      sections: WORLD_GEOGRAPHY_SECTIONS,
    },
  },
  planet: {
    label: "Planet / biome / culture",
    schema: {
      guidingQuestion: "Planetary profile, biome, culture, and exterior forces.",
      tagGroup: "RAG TAG",
      sections: WORLD_PLANET_BASE_SECTIONS,
      supportsSpoiler: true,
    },
  },
  worldPersona: {
    label: "World as character",
    schema: {
      guidingQuestion: "The world as a character—misbelief, desire, and global mood.",
      tagGroup: "RAG TAG",
      sections: WORLD_PERSONA_SECTIONS,
    },
  },
  stateLedger: {
    label: "Environmental state ledger",
    schema: {
      guidingQuestion: "Live world state—health, tension, and resource pressure.",
      tagGroup: "RAG TAG",
      sections: WORLD_STATE_SECTIONS,
      supportsSpoiler: true,
    },
  },
};

export function getWorldSectionSchema(
  sectionId: WorldSectionId,
  archetypeId?: WorldBlockArchetypeId | null
): RagOutlinePanelSchema {
  const base = WORLD_SECTION_SCHEMAS[sectionId].schema;
  if (sectionId !== "planet" || !archetypeId) return base;
  return {
    ...base,
    sections: mergePlanetArchetypeSections(WORLD_PLANET_BASE_SECTIONS, archetypeId),
  };
}

export const SETTING_BLOCK_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "Immediate scene location—spatial laws and local atmosphere.",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.4",
      title: "Scene location",
      fields: [
        field("parent_place", "Parent planet or region", "Spatial_Parent"),
        field("micro_climate", "Micro-climate & feel", "Spatial_Env: Micro_Climate", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("lighting", "Lighting & visibility", "Spatial_Env: Lighting"),
        field("landmarks", "Key landmarks", "Spatial_Feature", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

export function buildRagLineFromFields(
  tagGroup: string,
  fields: Record<string, string>,
  schema: RagOutlinePanelSchema
): string {
  return buildPanelRagLineFromSchema(
    { ...schema, tagGroup: tagGroup as RagOutlinePanelSchema["tagGroup"] },
    fields
  );
}
