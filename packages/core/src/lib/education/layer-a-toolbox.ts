/**
 * Layer A — grade-appropriate toolbox (P5 structural layer).
 * SSOT: docs/syntax-education/technical-specs/syntax_education_pillars.md §2.1.2
 */

export const GRADE_COHORTS = ["k3", "4_6", "7_9", "10_12", "12_plus"] as const;
export type GradeCohort = (typeof GRADE_COHORTS)[number];

export const WORKSPACE_TOOL_IDS = [
  "audio_dictionary",
  "number_line",
  "fraction_blocks",
  "read_along_diagnostics",
  "calculator_four_function",
  "visual_ruler",
  "spelling_synonym_popup",
  "calculator_scientific",
  "unit_converter",
  "coordinate_grid",
  "graphing_calculator_desmos",
  "periodic_table",
  "formula_sheets",
  "ide_sandbox",
  "financial_stats_toolkit",
] as const;

export type WorkspaceToolId = (typeof WORKSPACE_TOOL_IDS)[number];

export type WorkspaceToolSpec = {
  id: WorkspaceToolId;
  label: string;
  structural: true;
  component: string;
};

const TOOL_CATALOG: Record<WorkspaceToolId, WorkspaceToolSpec> = {
  audio_dictionary: {
    id: "audio_dictionary",
    label: "Local Audio Dictionary",
    structural: true,
    component: "AudioDictionaryWidget",
  },
  number_line: {
    id: "number_line",
    label: "Visual Number Line",
    structural: true,
    component: "NumberLineWidget",
  },
  fraction_blocks: {
    id: "fraction_blocks",
    label: "Virtual Fraction Blocks",
    structural: true,
    component: "FractionBlocksWidget",
  },
  read_along_diagnostics: {
    id: "read_along_diagnostics",
    label: "Oral Read-Along Diagnostics",
    structural: true,
    component: "ReadAlongWidget",
  },
  calculator_four_function: {
    id: "calculator_four_function",
    label: "Four-Function Calculator",
    structural: true,
    component: "CalculatorFourFunctionWidget",
  },
  visual_ruler: {
    id: "visual_ruler",
    label: "Interactive Visual Ruler",
    structural: true,
    component: "VisualRulerWidget",
  },
  spelling_synonym_popup: {
    id: "spelling_synonym_popup",
    label: "Spelling / Synonym Popups",
    structural: true,
    component: "SpellingSynonymWidget",
  },
  calculator_scientific: {
    id: "calculator_scientific",
    label: "Scientific Calculator",
    structural: true,
    component: "CalculatorScientificWidget",
  },
  unit_converter: {
    id: "unit_converter",
    label: "Unit Converter",
    structural: true,
    component: "UnitConverterWidget",
  },
  coordinate_grid: {
    id: "coordinate_grid",
    label: "Coordinate Graphing Grid",
    structural: true,
    component: "CoordinateGridWidget",
  },
  graphing_calculator_desmos: {
    id: "graphing_calculator_desmos",
    label: "Graphing Calculator (Desmos)",
    structural: true,
    component: "DesmosGraphingWidget",
  },
  periodic_table: {
    id: "periodic_table",
    label: "Periodic Table",
    structural: true,
    component: "PeriodicTableWidget",
  },
  formula_sheets: {
    id: "formula_sheets",
    label: "Universal Formula Sheets",
    structural: true,
    component: "FormulaSheetsWidget",
  },
  ide_sandbox: {
    id: "ide_sandbox",
    label: "IDE Developer Sandbox",
    structural: true,
    component: "IdeSandboxWidget",
  },
  financial_stats_toolkit: {
    id: "financial_stats_toolkit",
    label: "Financial / Statistical Toolkit",
    structural: true,
    component: "FinancialStatsWidget",
  },
};

const COHORT_TOOL_IDS: Record<GradeCohort, WorkspaceToolId[]> = {
  k3: [
    "audio_dictionary",
    "number_line",
    "fraction_blocks",
    "read_along_diagnostics",
  ],
  "4_6": [
    "calculator_four_function",
    "visual_ruler",
    "spelling_synonym_popup",
  ],
  "7_9": [
    "calculator_scientific",
    "unit_converter",
    "coordinate_grid",
  ],
  "10_12": [
    "graphing_calculator_desmos",
    "periodic_table",
    "formula_sheets",
  ],
  "12_plus": ["ide_sandbox", "financial_stats_toolkit"],
};

export function isGradeCohort(v: string): v is GradeCohort {
  return (GRADE_COHORTS as readonly string[]).includes(v);
}

export function parseGradeCohort(raw: string | undefined | null): GradeCohort {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (!s) return "7_9";
  if (s === "k3" || s === "k-3" || s.includes("k_3") || /^[pk]/.test(s)) return "k3";
  if (s === "4_6" || s === "4-6" || s.includes("grade_4") || s.includes("grade_5"))
    return "4_6";
  if (s === "10_12" || s === "10-12" || s.includes("high_school")) return "10_12";
  if (s === "12_plus" || s === "12+" || s.includes("ap") || s.includes("college"))
    return "12_plus";
  if (s === "7_9" || s === "7-9" || s.includes("middle")) return "7_9";

  const gradeNum = Number(s.replace(/[^0-9]/g, ""));
  if (Number.isFinite(gradeNum)) {
    if (gradeNum <= 3) return "k3";
    if (gradeNum <= 6) return "4_6";
    if (gradeNum <= 9) return "7_9";
    if (gradeNum <= 12) return "10_12";
    return "12_plus";
  }

  return "7_9";
}

export type LayerAToolboxConfig = {
  layer: "A";
  gradeCohort: GradeCohort;
  tools: WorkspaceToolSpec[];
  structuralLocked: true;
};

export function mapGradeCohortToLayerAToolbox(
  gradeCohort: string | GradeCohort
): LayerAToolboxConfig {
  const cohort = isGradeCohort(gradeCohort)
    ? gradeCohort
    : parseGradeCohort(gradeCohort);

  return {
    layer: "A",
    gradeCohort: cohort,
    tools: COHORT_TOOL_IDS[cohort].map((id) => TOOL_CATALOG[id]),
    structuralLocked: true,
  };
}
