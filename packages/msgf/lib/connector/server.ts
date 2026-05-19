/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
 */
/**
 * MSGF connector — server / BFF / co-located service imports (engines, Supabase, Redis).
 * Browser clients must use `msgf/connector` (thin HTTP client) only.
 */

export * from "./client";

export { Msgf, MsgfRuntime, getMsgfRuntime, type MsgfInitConfig } from "@/lib/msgf";

export {
  RemediationEngine,
  remediationEngine,
  MODULAR_STRATEGY_MATRIX,
  SCORED_MODULAR_STRATEGY_MATRIX,
  REMEDIATION_MATRIX,
  buildRemediationFixTemplate,
  normalizeBugIndexInstance,
  toAdminIncidentStrategyDto,
  type AdminIncidentStrategyDto,
  type ModularRemediationStrategy,
  type RemediationLogicScope,
  type RemediationMatrixRow,
  type RemediationRisk,
  type RemediationStrategy,
} from "../services/RemediationEngine";

export {
  MSGF_GOVERNANCE_PILLARS,
  PILLAR_BASELINE_REQUIRED_COUNT,
  ensureAuthorPillarBaseline,
  ensureTenantPillarBaseline,
  governancePillarForCategory,
  isAuthorPillarBaselineSet,
  isTenantPillarBaselineSet,
} from "../services/pillar-baseline";
export {
  deriveProjectOrigin,
  normalizeTenantId,
  resolveTenantIdForPillars,
  withMsgfMetadataScope,
  type MsgfMetadataScope,
} from "../services/msgf-metadata-scope";
export {
  withTenantIngestScope,
  type TenantIngestScope,
} from "../services/tenant-ingest-metadata";
export {
  IngestService,
  ingestService,
  determineBranch,
  determineCategory,
  pathToGenealogicalBugIndex,
  type IngestFile,
  type IngestServiceOptions,
} from "../services/IngestService";
export {
  LOGIC_DRIFT_ESCALATION_THRESHOLD,
  LOGIC_DRIFT_THRESHOLD_MIN,
  LOGIC_DRIFT_THRESHOLD_MAX,
  MSGF_BRAIN_SENSITIVITY_HEADER,
  MSGF_DRIFT_THRESHOLD_HEADER,
  assessLogicDrift,
  parseLogicDriftThresholdFromHeaders,
  resolveLogicDriftEscalationThreshold,
  shouldEscalateToGlobalBrain,
  type LogicDriftAssessment,
} from "../services/logic-drift";
export {
  LOCAL_STATE_BEAT_KIND,
  processLocalGateway,
  type LocalGatewayResult,
} from "../services/local-state-gateway";
export {
  sweepAndIngest,
  type SweepIngestOptions,
  type SweepIngestResult,
} from "../msgf-ingest";
export {
  bootstrapTenantBrain,
  computeBrainReadiness,
  type BrainReadinessResult,
} from "../services/brain-readiness";
export {
  DiagnosticSnapshotSchema,
  SelfHealReportBodySchema,
  type DiagnosticSnapshot,
  type SelfHealReportBody,
} from "../schemas/diagnostic-snapshot";
export { persistSelfHealReport, type SelfHealReportResult } from "../services/self-heal-report";
export { LogicDriftService, logicDriftService, type SentinelDriftAssessment } from "../services/LogicDriftService";
export {
  runEmergencyLomSession,
  type EmergencyLomSessionResult,
  type EmergencyLomVerdict,
} from "../services/emergency-lom-session";
export {
  applyLocalSessionDelta,
  LOCAL_DELTA_BEAT_KIND,
  type ApplyLocalSessionDeltaResult,
} from "../services/local-session-delta";
export { fetchVaultLineage111 } from "../services/vault-lineage-111";
export {
  deriveLineageDocumentId,
  invalidateAuthorLineageCache,
  msgfLineageCacheKey,
  resolvePrioritizedVaultLineageForP2,
  VAULT_LINEAGE_CACHE_TTL_SEC,
  type ResolvePrioritizedVaultLineageParams,
  type ResolvePrioritizedVaultLineageResult,
} from "../services/vault-lineage-p2-cache";
export {
  annotateLawBook,
  isGlobalSecurityLaw,
  lawConflictKey,
  LAW_BOOK_GLOBAL_VAULT,
  LAW_BOOK_TENANT_VAULT,
  loadMergedPulseVaultLineage111,
  listVaultLawBookExcerpts,
  mergeLawBooksWithGlobalSecurityPreempt,
  type LawBookExcerpt,
  type LawBookId,
} from "../services/context-loader";
export {
  MitigationService,
  mitigationService,
  applyGlobalMitigation,
  applyLocalMitigation,
  type ApplyGlobalMitigationResult,
  type MitigationServiceApplyParams,
  type MitigationServiceApplyLocalParams,
} from "../services/MitigationService";
export {
  GLOBAL_MITIGATIONS_NAMESPACE,
  GLOBAL_MITIGATIONS_RULE_KEY,
  loadGlobalMitigationsPayload,
  loadLayeredGlobalMitigationsPayload,
  applyLocalCompanyMitigation,
  formatGlobalMitigationsDirective,
  formatDefendHighPriorityConstraints,
  applyDefendMitigationOverrides,
  type GlobalMitigationsPayload,
  type GlobalMitigationEntry,
  type ApplyLocalCompanyMitigationParams,
} from "../services/msgf-global-rules";
export {
  getRedisClient,
  ensureRedisConnected,
  isRedisConfigured,
  redisGet,
  redisSet,
  redisDel,
} from "../redis-client";
export { msgfRedisKey } from "../redis";
export {
  insertMsgfUserSentinelIncident,
  MSGF_INCIDENT_SOURCE_USER_SENTINEL,
  type MsgfIncidentSource,
} from "../services/msgf-incidents";
export {
  HealthService,
  healthService,
  bugIndexToGovernancePillar,
  computeLogicDriftTrend,
  computePredictedStabilityPct,
  formatPredictiveStabilityTooltip,
  PREDICTIVE_PULSE_HORIZON,
  type PillarHealthReport,
  type PillarHealthEntry,
  type PillarStoplightStatus,
  type LogicDriftTrendReport,
} from "../services/HealthService";

export {
  PulseEngine,
  pulseEngine,
  type PulseEngineInput,
  type PulseFullPipelineInput,
  type PulseFullPipelineResult,
} from "../services/PulseEngine";
