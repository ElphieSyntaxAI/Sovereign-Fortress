export type {
  PrimeEvent,
  SovereignUser,
  TenantManifestEntry,
} from "./types/prime";

export type {
  BuildCalibrationOptions,
  CalibrationLocale,
  CalibrationResult,
  KeystrokeFingerprint,
  TenantScope,
} from "./lib/forensics/calibration-pure";
export {
  buildCalibrationResult,
  normalizedLatencySpread,
  rhythmAnomalyThresholdForLocale,
  segmentWordsForLocale,
  splitSentencesForLocale,
} from "./lib/forensics/calibration-pure";

export {
  mapGradeCohortToLayerAToolbox,
  parseGradeCohort,
  isGradeCohort,
  GRADE_COHORTS,
  WORKSPACE_TOOL_IDS,
  type GradeCohort,
  type LayerAToolboxConfig,
  type WorkspaceToolId,
  type WorkspaceToolSpec,
} from "./lib/education/layer-a-toolbox";
export {
  normalizeAiAllowanceLevel,
  resolveLayerBFlags,
  isAiAllowanceLevel,
  AI_ALLOWANCE_LEVELS,
  AI_ALLOWANCE_LEVEL_NAMES,
  type AiAllowanceLevel,
  type LayerBRuntimeFlags,
  type LayerBAllowanceEvent,
} from "./lib/education/layer-b-allowance";
export {
  resolveWorkspaceConfig,
  type ResolvedWorkspaceConfig,
} from "./lib/education/workspace-config";
