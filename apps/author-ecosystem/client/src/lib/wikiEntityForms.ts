import type { OutlineLoreKind } from "./outlineLoreKinds";
import { getOutlineLoreKindConfig } from "./outlineLoreKinds";
import {
  flattenSectionFields,
  type RagOutlinePanelSchema,
  type RagOutlineSection,
} from "./plotEngineRagOutlineSchema";

export type WikiFormTier = "blank" | "general" | "indepth";

export const WIKI_FORM_TIER_OPTIONS: { id: WikiFormTier; label: string; description: string }[] = [
  {
    id: "blank",
    label: "Blank page",
    description: "Write anything you want—your words become the wiki entry.",
  },
  {
    id: "general",
    label: "General",
    description: "Short prompts to nail the basics (RAG-aligned).",
  },
  {
    id: "indepth",
    label: "In-depth",
    description: "Expanded fields from your RAG templates for richer lore.",
  },
];

export type WikiFormFieldDef = {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** RAG tag reference from author-ecosystem/docs/rag templates */
  ragTag?: string;
  multiline?: boolean;
  rows?: number;
};

export type WikiEntityFormSchema = {
  kind: OutlineLoreKind;
  ragTemplate: string;
  blank: WikiFormFieldDef[];
  general: WikiFormFieldDef[];
  indepth: WikiFormFieldDef[];
};

const f = (
  id: string,
  label: string,
  opts?: Partial<WikiFormFieldDef>
): WikiFormFieldDef => ({ id, label, ...opts });

const BLANK_ONLY: WikiFormFieldDef[] = [
  f("freeform", "Your description", {
    multiline: true,
    rows: 12,
    placeholder: "Write the full entry in your own words…",
    hint: "Maps to wiki content and vector embedding on save.",
  }),
];

export const WIKI_ENTITY_FORM_SCHEMAS: Record<OutlineLoreKind, WikiEntityFormSchema> = {
  character: {
    kind: "character",
    ragTemplate: "Rag Ready Character Sheet.md",
    blank: BLANK_ONLY,
    general: [
      f("role", "Role in the story", {
        ragTag: "Field: Role",
        placeholder: "Protagonist, antagonist, supporting…",
      }),
      f("who", "Who are they?", {
        multiline: true,
        rows: 3,
        ragTag: "Field: BIO",
        placeholder: "Age, species, identity, one-line identity",
      }),
      f("like", "What are they like?", {
        multiline: true,
        rows: 3,
        ragTag: "Field: Persona_vibe",
        placeholder: "Temperament, vibe, how others experience them",
      }),
      f("motivation", "What do they want right now?", {
        multiline: true,
        rows: 2,
        ragTag: "Character Motivation",
      }),
      f("flaw_or_secret", "Flaw, fear, or secret (optional)", {
        multiline: true,
        rows: 2,
        ragTag: "Hidden_Data",
      }),
    ],
    indepth: [
      f("role", "Role in the story", { ragTag: "Field: Role" }),
      f("visual_identity", "Visual identity", {
        multiline: true,
        rows: 2,
        ragTag: "Field: Visual_Identity",
      }),
      f("persona_logic", "Persona logic", { ragTag: "Field: Persona_Logic", placeholder: "How they decide" }),
      f("persona_emotion", "Persona emotion", { ragTag: "Field: Persona_Emotion" }),
      f("speech", "Speech & mannerisms", { multiline: true, rows: 2, ragTag: "Speech mannerisms" }),
      f("values", "Core values & struggles", { multiline: true, rows: 2, ragTag: "Field: Values" }),
      f("backstory", "Backstory nodes", {
        multiline: true,
        rows: 3,
        ragTag: "Backstory_Node",
        placeholder: "Key life events that shaped them",
      }),
      f("relationships_positive", "Positive relationships", {
        multiline: true,
        rows: 2,
        ragTag: "Relation_Positive",
      }),
      f("relationships_negative", "Negative relationships", {
        multiline: true,
        rows: 2,
        ragTag: "Relation_Negative",
      }),
      f("agenda", "Political / religious agenda", { multiline: true, rows: 2, ragTag: "Agenda" }),
      f("hidden_secret", "Hidden data / secret", { multiline: true, rows: 2, ragTag: "Hidden_Data" }),
    ],
  },
  setting: {
    kind: "setting",
    ragTemplate: "RAG READY WORLD BIBLE.md §1.4 Spatial Laws",
    blank: BLANK_ONLY,
    general: [
      f("parent_place", "Parent planet or region", { ragTag: "Spatial_Parent" }),
      f("micro_climate", "Micro-climate / feel here", {
        multiline: true,
        rows: 2,
        ragTag: "Spatial_Env: Micro_Climate",
        placeholder: "Humidity, heat, underground, etc.",
      }),
      f("lighting", "Visibility / lighting", { ragTag: "Spatial_Env: Lighting" }),
      f("scene_now", "What is happening here right now?", {
        multiline: true,
        rows: 3,
        hint: "Immediate scene location—not the whole world.",
      }),
      f("landmarks", "Key landmarks (optional)", { multiline: true, rows: 2, ragTag: "Spatial_Feature" }),
    ],
    indepth: [
      f("parent_place", "Parent planet or region", { ragTag: "Spatial_Parent" }),
      f("micro_climate", "Micro-climate", { ragTag: "Spatial_Env: Micro_Climate" }),
      f("lighting", "Lighting", { ragTag: "Spatial_Env: Lighting" }),
      f("soundscape", "Acoustics / soundscape", { ragTag: "Spatial_Env: Soundscape" }),
      f("local_authority", "Local authority", { ragTag: "Spatial_Law: Local_Auth" }),
      f("security", "Security level", { ragTag: "Spatial_Law: Security", placeholder: "Low | Medium | High | Extreme" }),
      f("local_bans", "Local prohibitions", { multiline: true, rows: 2, ragTag: "Spatial_Law: Local_Bans" }),
      f("landmarks", "Points of interest", { multiline: true, rows: 2, ragTag: "Spatial_Feature" }),
      f("local_fauna", "Local flora / fauna", { multiline: true, rows: 2, ragTag: "Spatial_Bio" }),
      f("slang", "Local dialect / slang", { multiline: true, rows: 2, ragTag: "Spatial_Culture: Slang" }),
      f("scene_now", "Immediate scene action", { multiline: true, rows: 3 }),
    ],
  },
  environment: {
    kind: "environment",
    ragTemplate: "RAG READY WORLD BIBLE.md §1.3 Planetary + exterior forces",
    blank: BLANK_ONLY,
    general: [
      f("exterior_force", "What is going on in the world / exterior?", {
        multiline: true,
        rows: 3,
        placeholder: "War, storm season, plague, economic collapse…",
      }),
      f("climate", "Climate, weather, or planetary feel", {
        multiline: true,
        rows: 2,
        ragTag: "Planet_Weather: Type",
      }),
      f("impact", "How does this impact your characters?", {
        multiline: true,
        rows: 3,
        hint: "Pressures, limits, and mood from the outside world.",
      }),
      f("world_tone", "World tone in one paragraph", { multiline: true, rows: 2, ragTag: "Culture: Value_System" }),
    ],
    indepth: [
      f("gravity_atmosphere", "Gravity & atmosphere", { multiline: true, rows: 2, ragTag: "Planet_Phys" }),
      f("biome", "Biome / geography profile", { multiline: true, rows: 2, ragTag: "Planet_Geo: Biome" }),
      f("exterior_force", "Active exterior forces", { multiline: true, rows: 3 }),
      f("impact", "Impact on characters & plot", { multiline: true, rows: 3 }),
      f("culture_values", "Cultural value system", { multiline: true, rows: 2, ragTag: "Culture: Value_System" }),
      f("history_wound", "Historical wound or catastrophe", {
        multiline: true,
        rows: 2,
        ragTag: "History: The_Wound",
      }),
      f("system_law", "System-wide law or treaty", { multiline: true, rows: 2, ragTag: "System_Law" }),
      f("tech_level", "Tech / travel level (optional)", { multiline: true, rows: 2, ragTag: "Tech: Travel_Type" }),
    ],
  },
  plot_point: {
    kind: "plot_point",
    ragTemplate: "Rag Ready Outline.md",
    blank: BLANK_ONLY,
    general: [
      f("what_happens", "What happens in this beat?", {
        multiline: true,
        rows: 3,
        ragTag: "Plot-Point",
      }),
      f("character_impact", "How does this change the character?", {
        multiline: true,
        rows: 2,
        ragTag: "Character Name",
      }),
      f("environment", "Environmental pressure (optional)", {
        multiline: true,
        rows: 2,
        ragTag: "Environmental tag",
      }),
      f("why_matters", "Why does this beat matter?", { multiline: true, rows: 2 }),
    ],
    indepth: [
      f("era", "Story era", { ragTag: "Era", placeholder: "Beginning | Middle | End" }),
      f("what_happens", "Beat summary", { multiline: true, rows: 3, ragTag: "Plot-Point" }),
      f("character_links", "Characters involved", { multiline: true, rows: 2, ragTag: "Link to Character Sheets" }),
      f("location_links", "Locations involved", { multiline: true, rows: 2, ragTag: "Location" }),
      f("emotional_reason", "Emotional / plot reason to continue", {
        multiline: true,
        rows: 2,
        ragTag: "Internal Pivot",
      }),
      f("subplot", "Subplot notes", { multiline: true, rows: 2 }),
      f("spoiler_note", "Spoiler note for this beat", { multiline: true, rows: 2, ragTag: "Spoiler Level" }),
    ],
  },
  genre: {
    kind: "genre",
    ragTemplate: "Rag Ready Outline.md (genre) + Rag Ready Trope_Sensitivity Sheet.md",
    blank: BLANK_ONLY,
    general: [
      f("primary_genres", "Primary genre(s)", {
        placeholder: "Fantasy, romance, thriller…",
        ragTag: "Genre",
      }),
      f("pov", "Point of view", { ragTag: "Book Point of view", placeholder: "Third limited, first person…" }),
      f("reader_expectations", "What should readers expect?", { multiline: true, rows: 3 }),
      f("tone", "Tone & heat / violence level", { multiline: true, rows: 2 }),
    ],
    indepth: [
      f("primary_genres", "Genre list", { ragTag: "Genre" }),
      f("genre_blend", "Genre-blend notes", {
        multiline: true,
        rows: 2,
        ragTag: "Genre-Blend",
        placeholder: "Percent mix if blending genres",
      }),
      f("pov", "POV rules", { multiline: true, rows: 2, ragTag: "Multiple Point of view" }),
      f("trope_map", "Trope expectations / subversions", {
        multiline: true,
        rows: 3,
        ragTag: "Trope Subversion Map",
      }),
      f("sensitivity", "Sensitivity & cultural guardrails", {
        multiline: true,
        rows: 3,
        ragTag: "CULTURAL STATIC LEDGER",
      }),
      f("structure", "Structure style", {
        multiline: true,
        rows: 2,
        ragTag: "NARRATIVE STRUCTURE OVERRIDES",
      }),
      f("reader_expectations", "Reader promise", { multiline: true, rows: 3 }),
    ],
  },
  theme: {
    kind: "theme",
    ragTemplate: "Rag Ready Themes Sheet.md",
    blank: BLANK_ONLY,
    general: [
      f("central_question", "Central thematic question", {
        multiline: true,
        rows: 2,
        ragTag: "Theme_Query",
        placeholder: "Is security worth freedom?",
      }),
      f("positive_answer", "Positive pole of the theme", { multiline: true, rows: 2, ragTag: "Theme_Pos_A" }),
      f("negative_answer", "Negative pole of the theme", { multiline: true, rows: 2, ragTag: "Theme_Neg_A" }),
    ],
    indepth: [
      f("central_question", "Core inquiry", { multiline: true, rows: 2, ragTag: "Theme_Query" }),
      f("positive_a", "Positive answer A", { ragTag: "Theme_Pos_A" }),
      f("positive_b", "Positive answer B", { ragTag: "Theme_Pos_B" }),
      f("negative_a", "Negative answer A", { ragTag: "Theme_Neg_A" }),
      f("negative_b", "Negative answer B", { ragTag: "Theme_Neg_B" }),
      f("exemplar", "Character who proves the theme", { ragTag: "Theme_Proof_Character" }),
      f("cautionary", "Character cautionary tale", { ragTag: "Theme_Warning_Character" }),
      f("landmark", "Thematic landmark (world)", { ragTag: "Theme_Location" }),
      f("moral_test", "Plot beat that tests the theme", { ragTag: "Theme_Test" }),
      f("vocabulary", "Thematic vocabulary", { multiline: true, rows: 2, ragTag: "Theme_Vocabulary" }),
    ],
  },
  spoiler: {
    kind: "spoiler",
    ragTemplate: "Character Sheet Hidden_Data + Outline high-spoiler beats",
    blank: BLANK_ONLY,
    general: [
      f("what_spoiled", "What is being kept secret?", { multiline: true, rows: 3, ragTag: "Hidden_Data" }),
      f("who_knows", "Who knows vs. who must not know?", { multiline: true, rows: 2 }),
      f("when_reveal", "When should this be revealed?", { multiline: true, rows: 2, ragTag: "Plot-Point" }),
    ],
    indepth: [
      f("hidden_data", "Hidden data (full)", { multiline: true, rows: 4, ragTag: "Hidden_Data" }),
      f("plot_weight", "Plot weight", {
        placeholder: "Heavy | Medium | Light",
        ragTag: "Plot Weight",
      }),
      f("linked_beat", "Linked plot point", { ragTag: "Plot-Point" }),
      f("fan_safe", "Fan-safe summary (no spoil)", { multiline: true, rows: 2 }),
      f("author_notes", "Author-only notes", { multiline: true, rows: 2 }),
    ],
  },
};

export function getWikiFormSchema(kind: OutlineLoreKind): WikiEntityFormSchema {
  return WIKI_ENTITY_FORM_SCHEMAS[kind];
}

export function getFieldsForTier(schema: WikiEntityFormSchema, tier: WikiFormTier): WikiFormFieldDef[] {
  if (tier === "blank") return schema.blank;
  if (tier === "general") return schema.general;
  return schema.indepth;
}

export type ComposeWikiEntryInput = {
  kind: OutlineLoreKind;
  tier: WikiFormTier;
  title: string;
  answers: Record<string, string>;
  plotPoint?: string;
  spoilerLevel?: string;
  genres?: string;
};

export type ComposedWikiEntry = {
  excerpt: string;
  wiki_metadata: Record<string, unknown>;
  tags: string[];
};

/** Build wiki-ready markdown + metadata from tier form answers (RAG-aligned). */
export function composeWikiEntry(input: ComposeWikiEntryInput): ComposedWikiEntry {
  const config = getOutlineLoreKindConfig(input.kind);
  const schema = getWikiFormSchema(input.kind);
  const fields = getFieldsForTier(schema, input.tier);
  const tags = [...config.defaultTags, `form_tier:${input.tier}`];

  const lines: string[] = [
    `# ${config.label}: ${input.title.trim()}`,
    "",
    `**RAG template:** ${schema.ragTemplate}`,
    `**Form tier:** ${input.tier}`,
    `**Source type:** ${String(config.wiki_metadata?.source_type ?? "")}`,
    "",
  ];

  if (input.kind === "plot_point" && input.plotPoint) {
    lines.push(`**Plot point:** ${input.plotPoint}`, "");
    tags.push(`plot_point:${input.plotPoint}`);
  }
  if (input.kind === "spoiler" && input.spoilerLevel) {
    lines.push(`**Spoiler level:** ${input.spoilerLevel}`, "");
  }
  if (input.kind === "genre" && input.genres?.trim()) {
    lines.push(`**Genres:** ${input.genres.trim()}`, "");
  }

  const structuredTags: Array<{ name: string; value: string }> = [];

  for (const field of fields) {
    const val = String(input.answers[field.id] ?? "").trim();
    if (!val) continue;
    lines.push(`### ${field.label}`);
    if (field.ragTag) {
      lines.push(`*[${field.ragTag}]*`);
      structuredTags.push({ name: field.ragTag.replace(/\s+/g, "_"), value: val.slice(0, 500) });
    }
    lines.push(val, "");
  }

  const excerpt = lines.join("\n").trim();
  const wiki_metadata: Record<string, unknown> = {
    ...config.wiki_metadata,
    rag_template: schema.ragTemplate,
    wiki_form_tier: input.tier,
    wiki_form_answers: { ...input.answers },
    tags: structuredTags,
  };

  if (input.kind === "plot_point" && input.plotPoint) {
    wiki_metadata.plot_point = input.plotPoint;
  }
  if (input.kind === "spoiler" && input.spoilerLevel) {
    wiki_metadata.spoiler_level = input.spoilerLevel;
  }

  return { excerpt, wiki_metadata, tags };
}

export type ComposeSectionedWikiInput = ComposeWikiEntryInput & {
  panelSchema: RagOutlinePanelSchema;
  authorTags?: string[];
};

function walkSectionsInOrder(
  sections: RagOutlineSection[],
  answers: Record<string, string>,
  lines: string[],
  structuredTags: Array<{ name: string; value: string }>,
  sectionPaths: Record<string, string>
): void {
  for (const sec of sections) {
    const fieldEntries = (sec.fields ?? [])
      .map((field) => ({ field, val: String(answers[field.key] ?? "").trim() }))
      .filter((e) => e.val);

    const childHasContent = (s: RagOutlineSection): boolean => {
      const direct = (s.fields ?? []).some((f) => String(answers[f.key] ?? "").trim());
      return direct || (s.sections ?? []).some(childHasContent);
    };
    const hasContent = fieldEntries.length > 0 || childHasContent(sec);
    if (!hasContent) continue;

    lines.push(`## ${sec.sectionPath} ${sec.title}`, "");
    if (sec.aiInstruction) {
      lines.push(`*AI INSTRUCTION: ${sec.aiInstruction}*`, "");
    }
    if (sec.guidingQuestion) {
      lines.push(`*${sec.guidingQuestion}*`, "");
    }

    for (const { field, val } of fieldEntries) {
      if (field.ragTag) {
        lines.push(`RAG TAG: [${field.ragTag}: ${val}]`);
        structuredTags.push({
          name: field.ragTag.replace(/\s+/g, "_"),
          value: val.slice(0, 500),
        });
      } else {
        lines.push(`**${field.label}:** ${val}`);
      }
      sectionPaths[field.key] = sec.sectionPath;
      lines.push("");
    }

    if (sec.sections?.length) {
      walkSectionsInOrder(sec.sections, answers, lines, structuredTags, sectionPaths);
    }
  }
}

/** Build wiki markdown from section-numbered outline schema (Character Sheet / World Bible style). */
export function composeSectionedWikiEntry(input: ComposeSectionedWikiInput): ComposedWikiEntry {
  const config = getOutlineLoreKindConfig(input.kind);
  const schema = getWikiFormSchema(input.kind);
  const tags = [
    ...config.defaultTags,
    `form_tier:${input.tier}`,
    ...(input.authorTags ?? []).map((t) => `author:${t}`),
  ];

  const lines: string[] = [
    `# ${config.label}: ${input.title.trim()}`,
    "",
    `**RAG template:** ${schema.ragTemplate}`,
    `**Form tier:** ${input.tier}`,
    `**Source type:** ${String(config.wiki_metadata?.source_type ?? "")}`,
    "",
  ];

  if (input.authorTags?.length) {
    lines.push(`**Author tags:** ${input.authorTags.join(", ")}`, "");
  }

  const structuredTags: Array<{ name: string; value: string }> = [];
  const sectionPaths: Record<string, string> = {};

  if (input.panelSchema.sections?.length) {
    walkSectionsInOrder(
      input.panelSchema.sections,
      input.answers,
      lines,
      structuredTags,
      sectionPaths
    );
  } else {
    const { fields } = flattenSectionFields(input.panelSchema);
    for (const field of fields) {
      const val = String(input.answers[field.key] ?? "").trim();
      if (!val) continue;
      lines.push(`### ${field.label}`);
      if (field.ragTag) {
        lines.push(`RAG TAG: [${field.ragTag}: ${val}]`);
        structuredTags.push({
          name: field.ragTag.replace(/\s+/g, "_"),
          value: val.slice(0, 500),
        });
      }
      lines.push(val, "");
    }
  }

  const excerpt = lines.join("\n").trim();
  const wiki_metadata: Record<string, unknown> = {
    ...config.wiki_metadata,
    rag_template: schema.ragTemplate,
    wiki_form_tier: input.tier,
    wiki_form_answers: { ...input.answers },
    section_paths: sectionPaths,
    tags: structuredTags,
    author_tags: input.authorTags ?? [],
  };

  return { excerpt, wiki_metadata, tags };
}

/** Parse stored form answers from chunk metadata when re-opening a sheet. */
export function parseFormStateFromMetadata(
  meta: Record<string, unknown>
): { tier: WikiFormTier; answers: Record<string, string> } | null {
  const tier = meta.wiki_form_tier;
  const answers = meta.wiki_form_answers;
  if (tier !== "blank" && tier !== "general" && tier !== "indepth") return null;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { tier, answers: {} };
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    out[k] = String(v ?? "");
  }
  return { tier, answers: out };
}
