import type { PanelKey } from "./plotEngineTypes";
import { wikiRefDisplayTitle } from "./planningBlockTypes";

export type RagFieldType = "text" | "textarea" | "select" | "wikiLink";

export type RagOutlineField = {
  key: string;
  label: string;
  ragTag: string;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  fieldType?: RagFieldType;
  selectOptions?: string[];
  /** Filter for WikiEntityPicker when fieldType is wikiLink */
  wikiKind?: string;
};

export type RagOutlineSection = {
  sectionPath: string;
  title: string;
  aiInstruction?: string;
  guidingQuestion?: string;
  fields?: RagOutlineField[];
  sections?: RagOutlineSection[];
};

export type RagOutlinePanelSchema = {
  guidingQuestion: string;
  tagGroup: "RAG TAG" | "SENSES TAG" | "STYLE TAG" | "POV TAG";
  /** @deprecated Prefer sections; kept for backward compatibility */
  fields?: RagOutlineField[];
  sections?: RagOutlineSection[];
  ledgerTitle?: string;
  supportsSpoiler?: boolean;
};

const STYLE_FIELDS: RagOutlineField[] = [
  {
    key: "breadcrumb",
    label: "Breadcrumb",
    ragTag: "Breadcrumb",
    placeholder: "Any hints at what's coming?",
    hint: "Plant a clue the reader might notice later.",
  },
  {
    key: "breadcrumbHint",
    label: "Key hint",
    ragTag: "Breadcrumb Hint",
    placeholder: "The specific clue planted in this scene",
  },
  {
    key: "tone",
    label: "Tone",
    ragTag: "Tone",
    placeholder: "Hopeful, tense, bittersweet…",
  },
];

const POV_FIELDS: RagOutlineField[] = [
  {
    key: "chapterNumber",
    label: "Chapter number",
    ragTag: "Chapter Number",
    placeholder: "3",
  },
  {
    key: "chapterPov",
    label: "Whose POV?",
    ragTag: "Chapter POV",
    placeholder: "Character name",
  },
];

function ragPanel(
  guidingQuestion: string,
  tagGroup: RagOutlinePanelSchema["tagGroup"],
  sections: RagOutlineSection[],
  opts?: { supportsSpoiler?: boolean; ledgerTitle?: string }
): RagOutlinePanelSchema {
  return {
    guidingQuestion,
    tagGroup,
    sections,
    ...opts,
  };
}

export const RAG_OUTLINE_PANEL_SCHEMA: Record<PanelKey, RagOutlinePanelSchema> = {
  character: ragPanel(
    "Who is your main character in this scene?",
    "RAG TAG",
    [
      {
        sectionPath: "1.1.1",
        title: "Main character",
        guidingQuestion: "Who is your main character?",
        fields: [
          {
            key: "characterName",
            label: "Character name",
            ragTag: "Character Name",
            placeholder: "Main character",
          },
          {
            key: "characterSheetLink",
            label: "Link to character sheet",
            ragTag: "Link to Character Sheets",
            fieldType: "wikiLink",
            wikiKind: "character",
          },
        ],
      },
      {
        sectionPath: "1.1.2",
        title: "Style & point of view",
        guidingQuestion: "How does this scene feel, and who is telling it?",
        fields: [...STYLE_FIELDS, ...POV_FIELDS],
      },
    ],
    { supportsSpoiler: true }
  ),
  environmental: ragPanel(
    "What is happening around them that the story needs?",
    "RAG TAG",
    [
      {
        sectionPath: "1.1.1",
        title: "World context",
        guidingQuestion: "What outside forces shape this moment?",
        fields: [
          {
            key: "worldBibleLink",
            label: "Link to world bible",
            ragTag: "Link to World Bible",
            fieldType: "wikiLink",
            wikiKind: "environment",
          },
          {
            key: "environmentalTag",
            label: "What's happening in the environment",
            ragTag: "Environmental tag",
            placeholder: "Storm season, occupation, plague…",
            multiline: true,
            fieldType: "textarea",
          },
        ],
      },
      {
        sectionPath: "1.1.2",
        title: "Style & point of view",
        fields: [...STYLE_FIELDS, ...POV_FIELDS],
      },
    ],
    { supportsSpoiler: true }
  ),
  settings: ragPanel(
    "Where is the story taking place?",
    "RAG TAG",
    [
      {
        sectionPath: "1.1.1",
        title: "Location",
        guidingQuestion:
          "Where is the story taking place? How does the setting reflect your world's misbelief?",
        fields: [
          {
            key: "location",
            label: "Location",
            ragTag: "Location",
            placeholder: "Planet, city, room…",
          },
          {
            key: "worldSheetLink",
            label: "Link to world character sheet",
            ragTag: "Link to World Character Sheet",
            fieldType: "wikiLink",
            wikiKind: "environment",
          },
          {
            key: "thematicWorksheetLink",
            label: "Link to thematic worksheet",
            ragTag: "Link to Thematic Worksheet",
            fieldType: "wikiLink",
            wikiKind: "theme",
          },
        ],
      },
      {
        sectionPath: "1.1.2",
        title: "Style & point of view",
        fields: [...STYLE_FIELDS, ...POV_FIELDS],
      },
    ],
    { supportsSpoiler: true }
  ),
  senses: ragPanel("What does the POV notice in this scene?", "SENSES TAG", [
    {
      sectionPath: "1.0",
      title: "Sensory details",
      guidingQuestion: "What does the POV notice in this scene?",
      fields: [
        { key: "hear", label: "Sounds", ragTag: "Hear", placeholder: "Rain on glass, distant sirens…" },
        { key: "smell", label: "Scents", ragTag: "Smell", placeholder: "Old books, ozone, coffee…" },
        {
          key: "touch",
          label: "Textures & temperature",
          ragTag: "Touch",
          placeholder: "Rough stone, cold air…",
        },
        { key: "taste", label: "Tastes", ragTag: "Taste", placeholder: "Metallic fear, sweet wine…" },
        { key: "see", label: "Visual details", ragTag: "See", placeholder: "Flickering neon, cracked pavement…" },
      ],
    },
  ]),
  breadcrumbs: ragPanel("What clues are planted for later payoff?", "STYLE TAG", [
    {
      sectionPath: "1.0",
      title: "Breadcrumbs",
      guidingQuestion: "What clues or hints are planted for later payoff?",
      fields: STYLE_FIELDS,
    },
  ]),
  theme: ragPanel("What thematic thread runs through this scene?", "STYLE TAG", [
    {
      sectionPath: "1.0",
      title: "Theme",
      fields: [
        {
          key: "theme",
          label: "Theme",
          ragTag: "Theme",
          placeholder: "Found family, cost of power…",
        },
        ...STYLE_FIELDS,
      ],
    },
  ]),
  mood: ragPanel("What mood should the reader feel?", "STYLE TAG", [
    {
      sectionPath: "1.0",
      title: "Mood & tone",
      fields: [
        {
          key: "mood",
          label: "Mood",
          ragTag: "Mood",
          placeholder: "Uneasy, triumphant, melancholy…",
        },
        {
          key: "tone",
          label: "Narrative tone",
          ragTag: "Tone",
          placeholder: "Wry, lyrical, stark…",
        },
      ],
    },
  ]),
  spoilerLevel: ragPanel(
    "Where does this beat sit in your story?",
    "RAG TAG",
    [
      {
        sectionPath: "1.0",
        title: "Plot beat",
        guidingQuestion: "Label this beat so retrieval stays spoiler-safe.",
        fields: [
          {
            key: "plotPoint",
            label: "Plot point",
            ragTag: "Plot-Point",
            placeholder: "Hook, Midpoint, Climax…",
          },
          {
            key: "spoilerLevel",
            label: "Spoiler level",
            ragTag: "Spoiler Level",
            fieldType: "select",
            selectOptions: ["low", "medium", "high"],
            placeholder: "low",
          },
          {
            key: "era",
            label: "Story era",
            ragTag: "Era",
            placeholder: "Beginning, Middle, End",
          },
        ],
      },
    ]
  ),
};

export function flattenSectionFields(schema: {
  sections?: RagOutlineSection[];
}): { fields: RagOutlineField[]; sectionPaths: Record<string, string> } {
  const fields: RagOutlineField[] = [];
  const sectionPaths: Record<string, string> = {};

  function walk(sections: RagOutlineSection[]) {
    for (const sec of sections) {
      for (const field of sec.fields ?? []) {
        fields.push(field);
        sectionPaths[field.key] = sec.sectionPath;
      }
      if (sec.sections?.length) walk(sec.sections);
    }
  }

  if (schema.sections?.length) walk(schema.sections);
  return { fields, sectionPaths };
}

/** All fields from a panel schema (sections or legacy flat fields). */
export function getSchemaFields(schema: RagOutlinePanelSchema): RagOutlineField[] {
  if (schema.sections?.length) return flattenSectionFields(schema).fields;
  return schema.fields ?? [];
}

export function sectionProgress(
  section: RagOutlineSection,
  fields: Record<string, string>
): { filled: number; total: number } {
  const leafFields: RagOutlineField[] = [];
  function collect(sec: RagOutlineSection) {
    for (const f of sec.fields ?? []) leafFields.push(f);
    for (const child of sec.sections ?? []) collect(child);
  }
  collect(section);
  const total = leafFields.length;
  const filled = leafFields.filter((f) => String(fields[f.key] ?? "").trim()).length;
  return { filled, total };
}

export function firstIncompleteSectionPath(
  schema: RagOutlinePanelSchema,
  fields: Record<string, string>
): string | null {
  for (const sec of schema.sections ?? []) {
    const { filled, total } = sectionProgress(sec, fields);
    if (total > 0 && filled < total) return sec.sectionPath;
    for (const child of sec.sections ?? []) {
      const childProg = sectionProgress(child, fields);
      if (childProg.total > 0 && childProg.filled < childProg.total) return child.sectionPath;
    }
  }
  return schema.sections?.[0]?.sectionPath ?? null;
}

/** Default spoiler level from plot beat position (0-based index). */
export function defaultSpoilerLevelForPlotIndex(plotIndex: number, totalPlots: number): string {
  if (totalPlots <= 1) return "low";
  const ratio = plotIndex / Math.max(totalPlots - 1, 1);
  if (ratio >= 0.75) return "high";
  if (ratio >= 0.4) return "medium";
  return "low";
}

/** Default era from plot beat position. */
export function defaultEraForPlotIndex(plotIndex: number, totalPlots: number): string {
  if (totalPlots <= 1) return "Beginning";
  const ratio = plotIndex / Math.max(totalPlots - 1, 1);
  if (ratio >= 0.66) return "End";
  if (ratio >= 0.33) return "Middle";
  return "Beginning";
}

export function getOutlineFieldValue(
  fields: Record<string, string> | undefined,
  key: string
): string {
  return String(fields?.[key] ?? "").trim();
}

export function buildRagTagSegmentsFromFields(
  schema: RagOutlinePanelSchema,
  fields: Record<string, string> | undefined
): string[] {
  const segments: string[] = [];
  for (const field of getSchemaFields(schema)) {
    const val = getOutlineFieldValue(fields, field.key);
    if (!val) continue;
    if (field.fieldType === "select" && field.key === "spoilerLevel") {
      segments.push(`[Spoiler Level: ${capitalize(val)}]`);
    } else if (field.fieldType === "wikiLink") {
      const display = wikiRefDisplayTitle(val);
      segments.push(`[${field.ragTag}: ${display}]`);
    } else {
      segments.push(`[${field.ragTag}: ${val}]`);
    }
  }
  if (schema.supportsSpoiler && fields?.containsSpoiler === "true") {
    const existing = segments.some((s) => s.toLowerCase().includes("spoiler level"));
    if (!existing) segments.push("[Spoiler Level: High]");
  }
  return segments;
}

export function buildRagTagSegments(
  panel: PanelKey,
  fields: Record<string, string> | undefined
): string[] {
  return buildRagTagSegmentsFromFields(RAG_OUTLINE_PANEL_SCHEMA[panel], fields);
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function buildPanelRagLineFromSchema(
  schema: RagOutlinePanelSchema,
  fields: Record<string, string> | undefined
): string {
  const segments = buildRagTagSegmentsFromFields(schema, fields);
  if (!segments.length) return "";
  return `${schema.tagGroup}: ${segments.join(" | ")}`;
}

export function buildPanelRagLine(
  panel: PanelKey,
  fields: Record<string, string> | undefined
): string {
  return buildPanelRagLineFromSchema(RAG_OUTLINE_PANEL_SCHEMA[panel], fields);
}
