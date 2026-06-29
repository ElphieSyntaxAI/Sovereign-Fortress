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
      title: "Physical environment",
      fields: [
        field("planet_phys", "Gravity & atmosphere", "Planet_Phys", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Low gravity, thin ozone…",
        }),
        field("planet_weather", "Climate & weather", "Planet_Weather: Type", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("micro_climate", "Micro-climate here", "Spatial_Env: Micro_Climate", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Humid docks, perpetual twilight…",
        }),
      ],
    },
  ],
};

const SPECIES_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "Who lives here — and how do groups relate?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.2",
      title: "Species & factions",
      fields: [
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
          placeholder: "Gang turf, unwritten codes…",
        }),
      ],
    },
  ],
};

const BELIEFS_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What do people believe — and how does faith shape daily life?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.4",
      title: "Beliefs & religions",
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
        field("value_system", "Cultural values", "Culture: Value_System", {
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
        field("fauna_profile", "Global fauna profile", "Flora/Fauna Profile", {
          multiline: true,
          fieldType: "textarea",
        }),
        field("local_creature", "Creature found here", "Spatial_Bio", {
          multiline: true,
          fieldType: "textarea",
          placeholder: "Glass-wing moths, trench leviathans…",
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

const FLORA_FOOD_SCHEMA: RagOutlinePanelSchema = {
  guidingQuestion: "What grows here — and what do people eat?",
  tagGroup: "RAG TAG",
  sections: [
    {
      sectionPath: "1.3.5",
      title: "Flora, foods & diets",
      guidingQuestion: "Tie diets to the fauna and flora you defined above.",
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
        field("staple_crop", "Staple flora", "Flora: Staple", {
          multiline: true,
          fieldType: "textarea",
        }),
      ],
    },
  ],
};

export const CIVILIZATION_STACK_SCHEMAS: Record<CivilizationStackLayer, RagOutlinePanelSchema> = {
  environment: ENVIRONMENT_SCHEMA,
  species: SPECIES_SCHEMA,
  government: GOVERNMENT_SCHEMA,
  beliefs: BELIEFS_SCHEMA,
  fauna: FAUNA_SCHEMA,
  flora_food: FLORA_FOOD_SCHEMA,
};

export const CIVILIZATION_STACK_LAYER_META: Record<
  CivilizationStackLayer,
  { title: string; emoji: string; hint?: string }
> = {
  environment: {
    title: "Environmental constants & micro-climates",
    emoji: "🌡️",
  },
  species: {
    title: "Species & biodiversity",
    emoji: "🧫",
  },
  government: {
    title: "Governments & laws",
    emoji: "🏛️",
  },
  beliefs: {
    title: "Beliefs & religions",
    emoji: "🛐",
  },
  fauna: {
    title: "Fauna & wild ecosystems",
    emoji: "🐺",
  },
  flora_food: {
    title: "Flora, foods & diets",
    emoji: "🍲",
    hint: "What do people eat here? Tie it to the fauna and flora you defined above.",
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
