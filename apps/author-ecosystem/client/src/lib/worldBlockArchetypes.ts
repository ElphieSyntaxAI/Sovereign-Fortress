import type { RagOutlineSection } from "./plotEngineRagOutlineSchema";

export type WorldBlockArchetypeId = "solar_system" | "planet" | "religion" | "general";

export type WorldBlockArchetype = {
  id: WorldBlockArchetypeId;
  label: string;
  description: string;
  /** Optional default title when creating a block */
  defaultTitle?: string;
  /** Extra sections merged into planet schema */
  extraSections?: RagOutlineSection[];
  /** Seed values for outlineFields when archetype is chosen */
  seedFields?: Record<string, string>;
};

export const WORLD_BLOCK_ARCHETYPES: WorldBlockArchetype[] = [
  {
    id: "general",
    label: "General planet / region",
    description: "Standard planetary profile—biome, culture, exterior forces.",
  },
  {
    id: "solar_system",
    label: "Create your solar system",
    description: "Star type, orbits, and system-scale geography.",
    defaultTitle: "Solar system",
    extraSections: [
      {
        sectionPath: "1.2.1",
        title: "System anchor",
        guidingQuestion: "What kind of star system is this?",
        fields: [
          {
            key: "system_anchor",
            label: "Star configuration",
            ragTag: "System_Anchor",
            placeholder: "Single star, binary, black hole…",
          },
          {
            key: "barycenter_logic",
            label: "How stars orbit each other",
            ragTag: "Stellar_Motion",
            placeholder: "Describe barycenter logic",
            multiline: true,
            fieldType: "textarea",
          },
          {
            key: "frost_line",
            label: "Frost line (AU)",
            ragTag: "System_Scale",
            placeholder: "Distance in AU",
          },
        ],
      },
    ],
    seedFields: { systemGeography: "" },
  },
  {
    id: "planet",
    label: "Planet profile",
    description: "A named world—gravity, biome, and cultural footprint.",
    defaultTitle: "New planet",
    extraSections: [
      {
        sectionPath: "1.3.1",
        title: "Planet identity",
        guidingQuestion: "Name and classify this world.",
        fields: [
          {
            key: "planet_name",
            label: "Planet name",
            ragTag: "Planet_Name",
            placeholder: "Aethros",
          },
          {
            key: "planet_class",
            label: "Planet type",
            ragTag: "Planet_Class",
            placeholder: "Terrestrial, gas giant, moon…",
          },
        ],
      },
    ],
  },
  {
    id: "religion",
    label: "Religion & belief",
    description: "Sacred objects, rituals, and how faith shapes culture.",
    defaultTitle: "Religion",
    extraSections: [
      {
        sectionPath: "1.3.4",
        title: "Beliefs & practices",
        guidingQuestion: "How does faith operate in this world?",
        fields: [
          {
            key: "deity_or_force",
            label: "Deity or sacred force",
            ragTag: "Religion: Deity",
            placeholder: "The Twin Suns, the Deep Current…",
          },
          {
            key: "sacred_objects",
            label: "Sacred objects",
            ragTag: "Religion: Sacred_Objects",
            multiline: true,
            fieldType: "textarea",
            placeholder: "Relics, texts, pilgrimage sites…",
          },
          {
            key: "rituals",
            label: "Rituals & taboos",
            ragTag: "Religion: Rituals",
            multiline: true,
            fieldType: "textarea",
          },
          {
            key: "faith_impact",
            label: "How faith shapes daily life",
            ragTag: "Religion: Cultural_Impact",
            multiline: true,
            fieldType: "textarea",
          },
        ],
      },
    ],
  },
];

export function getWorldArchetype(id: WorldBlockArchetypeId | null | undefined): WorldBlockArchetype {
  return WORLD_BLOCK_ARCHETYPES.find((a) => a.id === id) ?? WORLD_BLOCK_ARCHETYPES[0];
}

export function mergePlanetArchetypeSections(
  base: RagOutlineSection[],
  archetypeId: WorldBlockArchetypeId
): RagOutlineSection[] {
  const archetype = getWorldArchetype(archetypeId);
  if (!archetype.extraSections?.length || archetypeId === "general") return base;
  return [...base, ...archetype.extraSections];
}
