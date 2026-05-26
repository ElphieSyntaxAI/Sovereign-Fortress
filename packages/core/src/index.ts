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

export {
  MSGF_ADMIN_PORTAL_PATH,
  MSGF_ADMIN_SIGN_IN_PATH,
  MSGF_AUTH_CALLBACK_PATH,
  ElphieAuthCallbackNextKey,
  buildMsgfAdminPortalUrl,
  buildMsgfAdminSignInUrl,
  buildMsgfAuthCallbackUrl,
  clearStashedAuthCallbackNext,
  isSafeRelativePath,
  readStashedAuthCallbackNext,
  resolveMsgfAppOrigin,
  stashAuthCallbackNext,
  type PlatformSurface,
} from "./lib/platform-admin-auth";

/** Server-only HMAC helpers: import `@elphie-syntax/core/operator-handoff-token`. */
export {
  buildMsgfAuthorHandoffUrl,
  sanitizeAuthorReturnToUrl,
  type OperatorHandoffPayload,
} from "./lib/operator-handoff-url";

export {
  ELPHIE_PRODUCT_HOSTS,
  PLATFORM_HUB_ENTRIES,
  PLATFORM_HUB_ROADMAP_AS_OF,
  availabilityLabel,
  productionMapLine,
  type PlatformHubAvailability,
  type PlatformHubEntry,
  type PlatformHubRoadmapPhase,
  type PlatformHubTone,
} from "./lib/platform-hub-content";
