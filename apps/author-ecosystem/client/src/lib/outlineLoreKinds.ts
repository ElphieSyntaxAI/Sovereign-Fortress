export type OutlineLoreKind =
  | "character"
  | "setting"
  | "environment"
  | "plot_point"
  | "genre"
  | "theme"
  | "spoiler";

export const PLOT_POINT_OPTIONS = [
  { value: "hook", label: "Hook" },
  { value: "inciting_incident", label: "Inciting incident" },
  { value: "internal_pivot", label: "Internal pivot" },
  { value: "point_of_no_return", label: "Point of no return" },
  { value: "midpoint", label: "Midpoint" },
  { value: "deepdive_aha", label: "Deep dive / A-ha" },
  { value: "climax", label: "Climax" },
  { value: "twist", label: "Twist" },
  { value: "resolution", label: "Resolution" },
  { value: "parallel_arc", label: "Parallel arc" },
  { value: "not_applicable", label: "Not tied to beat" },
] as const;

export const SPOILER_LEVEL_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export type OutlineLoreKindConfig = {
  kind: OutlineLoreKind;
  label: string;
  railLabel: string;
  /** Short line shown on wiki edit rail hover. */
  railHoverTip: string;
  description: string;
  chunk_type: string;
  defaultTags: string[];
  wiki_metadata?: Record<string, unknown>;
};

export const OUTLINE_LORE_KINDS: OutlineLoreKindConfig[] = [
  {
    kind: "character",
    label: "Character",
    railLabel: "Character",
    railHoverTip: "Who is in the story? What are they like?",
    description: "Cast member, role, and story function.",
    chunk_type: "character",
    defaultTags: ["character"],
    wiki_metadata: { source_type: "character_sheet", outline_entity_kind: "character" },
  },
  {
    kind: "setting",
    label: "Setting",
    railLabel: "Setting",
    railHoverTip: "Where is this immediately happening?",
    description: "The place or venue the scene is in right now.",
    chunk_type: "location",
    defaultTags: ["setting", "location"],
    wiki_metadata: { source_type: "world_bible", outline_entity_kind: "setting" },
  },
  {
    kind: "environment",
    label: "Environment",
    railLabel: "Environment",
    railHoverTip:
      "What is going on in the world or exterior that is impacting the characters?",
    description:
      "World bible: climate, ecology, and outside forces shaping the story (not the immediate scene location).",
    chunk_type: "location",
    defaultTags: ["environment", "world", "world_bible"],
    wiki_metadata: {
      source_type: "world_bible",
      outline_entity_kind: "environment",
      world_bible_section: "environment",
    },
  },
  {
    kind: "plot_point",
    label: "Plot point",
    railLabel: "Plot point",
    railHoverTip: "What beat happens here, and how does it move the story forward?",
    description: "Outline beat anchored to a narrative plot point.",
    chunk_type: "event",
    defaultTags: ["plot_point", "outline"],
    wiki_metadata: {
      source_type: "story_outline",
      outline_entity_kind: "plot_point",
      plot_point: "not_applicable",
    },
  },
  {
    kind: "genre",
    label: "Genre(s)",
    railLabel: "Genre",
    railHoverTip: "What kind of story is this for readers (genre, tone, expectations)?",
    description: "Genre tags and reader expectations for this manuscript.",
    chunk_type: "other",
    defaultTags: ["genre"],
    wiki_metadata: { source_type: "theme_sheet", outline_entity_kind: "genre" },
  },
  {
    kind: "theme",
    label: "Theme",
    railLabel: "Theme",
    railHoverTip: "What deeper idea, question, or moral thread runs through the story?",
    description: "Thematic through-line or moral question.",
    chunk_type: "theme",
    defaultTags: ["theme"],
    wiki_metadata: {
      source_type: "theme_sheet",
      outline_entity_kind: "theme",
      narrative_master_logic: true,
    },
  },
  {
    kind: "spoiler",
    label: "Spoiler",
    railLabel: "Spoiler",
    railHoverTip: "Secret or twist lore to keep hidden from fan preview until you publish it.",
    description: "Hidden or high-spoiler lore (fan preview will hide when level is above low).",
    chunk_type: "other",
    defaultTags: ["spoiler", "hidden_data"],
    wiki_metadata: {
      source_type: "story_outline",
      outline_entity_kind: "spoiler",
      spoiler_level: "high",
      plot_point: "not_applicable",
    },
  },
];

export function getOutlineLoreKindConfig(kind: OutlineLoreKind): OutlineLoreKindConfig {
  const row = OUTLINE_LORE_KINDS.find((k) => k.kind === kind);
  if (!row) throw new Error(`Unknown outline lore kind: ${kind}`);
  return row;
}
