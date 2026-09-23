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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
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
 * Distribution Build ID: MSGF-1013d7a-20260522T020901Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering â€” including decompilation, disassembly, or derivative
 * works â€” is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
/**
 * MSGF V3.2-ULTRA Pulse pipeline â€” SHARD â†’ DEFEND â†’ CONVERGE â†’ PERSIST.
 * Modular: no imports from apps/author-ecosystem.
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  StateLedgerP4,
  chunkKeystrokeStream,
  type KeystrokeChunk,
  type KeystrokeEvent,
  type StateBeatRow,
} from "@/lib/P4";
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import {
  calculateBiometricScore,
  calculateHalScore,
  getBiometricProfile,
  recalibrateUser,
  upsertBiometricProfileFromPulse,
  type HalScoreResult,
  type ModelVerdict,
} from "@/lib/msgf-consensus";
import {
  getGcpProjectId,
  getVertexGenerativeModelForId,
} from "@/lib/msgf-vertex";
import {
  getActiveSlice,
  setActiveSlice,
  HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
} from "@/lib/msgf-hot-layer";
import { msgfRedisKey } from "@/lib/redis";
import {
  runDefendPreflight as preFlightCheck,
  type DefendPreflightResult as ShadowPreflightResult,
} from "@/lib/defend-preflight";
import { pillarGateMeta } from "@/lib/msgf-pillar-meta";
import {
  PULSE_BUG_INDEX,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import {
  persistToHall,
  persistToVault,
  type ConstraintLedgerPersistResult,
} from "@/lib/services/constraint-ledger";
import { buildArbitrateNarrativeExtra } from "@/lib/services/arbitrate-narrative-meta";
import {
  isHitlTiebreakerBugIndex,
  type HitlStrategyGenerationContext,
} from "@/lib/services/hitl-strategy-generator";
import { insertMsgfArbitrateIncident } from "@/lib/services/msgf-incidents";
import type { MitigationAction } from "@/lib/schemas/mitigation-action";
import { fetchProfileCompanyAndRole } from "@/lib/msgf-operator-access";
import {
  applyDefendMitigationOverrides,
  formatDefendHighPriorityConstraints,
  formatGlobalMitigationsDirective,
  loadLayeredGlobalMitigationsPayload,
  type GlobalMitigationsPayload,
} from "@/lib/services/msgf-global-rules";
import {
  attachSourceAuditToBeatMetadata,
  applyReputationOutcome,
  recordSourceAudit,
} from "@/lib/services/source-audit";
import type { SourceHit } from "@/lib/schemas/source-audit";
import { incidentAttributionMetadataFromHits } from "@/lib/services/trusted-license-allowlist";
import {
  buildP2RoadmapDirective,
  buildVaultCrossRefContext,
  loadP2Roadmap,
  type P2RoadmapConfig,
  type PrioritizedVaultLineage,
} from "@/lib/services/p2-flow-roadmap";
import { resolvePrioritizedVaultLineageForP2 } from "@/lib/services/vault-lineage-p2-cache";
import { applyConvergeShardableContextBudget } from "@/lib/services/converge-context-budget";
import {
  buildConvergeResolutionString,
  computeConvergeAgreementScore,
  computeConvergeContentHash,
  getOrSetConvergeCache,
  resolveConvergeRoutingProfile,
  type ConvergeCachedChunk,
} from "@/lib/services/converge-cache";
import {
  quarantineVaultFromTierDisagreement,
  type TierQuarantineResult,
} from "@/lib/services/converge-tier/tier-quarantine";
import type { PulseLicenseContext } from "@/lib/services/pulse-license";
import { assessLogicDrift, shouldEscalateToGlobalBrain } from "@/lib/services/logic-drift";
import { processLocalGateway } from "@/lib/services/local-state-gateway";
import {
  isDualModelLocalGatewayEnabled,
  runTenantAnthropicValidation,
  runTenantDualModelConsensusGateway,
  runTenantGeminiValidation,
  runTenantXaiValidation,
  platformXaiApiKey,
  type DualModelGatewaySnapshot,
} from "@/lib/services/dual-model-consensus-gateway";
import {
  resolveBigBrainConsensusConfig,
  resolveHumanNotifyThreshold,
  isTriConsensusEnabled,
} from "@/lib/services/consensus/msgf-consensus-config";
import { decideConsensusVote, shouldNotifyHuman } from "@/lib/services/consensus/majority-vote";
import {
  buildConvergePublicResponseFields,
  isConvergeEscalationBypassOrDegraded,
  resolveConvergeConsensusRouting,
  shouldRunLocalDualModelGateway,
  usesPlatformMasterConvergeCredentials,
} from "@/lib/services/converge-consensus-routing";
import { recordPerpetualPlatformConvergeSlice } from "@/lib/services/paid-individual-usage";
import {
  ensureTenantPillarBaseline,
  isTenantPillarBaselineSet,
} from "@/lib/services/pillar-baseline";
import {
  assertP1UniversalNonPolluted,
  P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS,
  type UniversalP1PulseBody,
} from "@/src/lib/universal/p1HalStandard";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import {
  applyStateBeatsEntityFilter,
  applyStateBeatsTenantFilter,
} from "@/lib/services/tenant-query-scope";
import {
  assertGlobalWriteAllowed,
  GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS,
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS,
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
  isVaultCoreTenant,
  vaultCoreWriteForTenant,
  type GlobalPromotionStatus,
  type LogicDelta,
  type PersistLogicDeltaGateResult,
} from "@/lib/services/global-approval-gate";
import { saveLogicDeltaToLocalCache } from "@/lib/services/local-state-cache";
import {
  buildPulseGlassBoxData,
  buildPulseRemediationSummaryGlobal,
  buildPulseRemediationSummaryLocal,
  stripPublicBeat,
} from "@/lib/services/pulse-public-response";
import {
  MAX_RECURSION_DEPTH,
  isCostRunawayError,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";
import type { PulseHotSession } from "@/lib/services/pulse-hot-session";
import { generatePublisherText } from "@/lib/services/vertex-publisher-generate";
import { ecoAggregatorClient } from "@/lib/services/EcoAggregatorClient";
import { runV32PulsePipeline } from "@/lib/services/pulse-pipeline/run-v32-pipeline";
import {
  recordRemediationFailure,
  recordRemediationSuccess,
  resolveRemediationFilePath,
  tripRemediationCircuitBreaker,
} from "@/lib/services/remediation-retry-circuit";

const LOM_MAX_ATTEMPTS = MAX_RECURSION_DEPTH;
/** HITL / LOM recursion ceiling â€” exceeding throws {@link ERR_RECURSION_LIMIT}. */
export const PULSE_RECURSION_MAX_RETRY = MAX_RECURSION_DEPTH;

/** At this retry count, CONVERGE emits a Halt-State Summary for the Human Tie-Breaker. */
export const PULSE_HALT_STATE_RETRY = 3;

const LINEAGE_INSTANCE = "1.1.1";
const LINEAGE_CATEGORY = "P6";
const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const CLAUDE_VERTEX_LOCATION =
  process.env.MSGF_CLAUDE_VERTEX_LOCATION?.trim() ||
  process.env.GCP_CLAUDE_LOCATION?.trim() ||
  "global";
const CLAUDE_MODEL_ID = process.env.MSGF_CLAUDE_MODEL || "claude-sonnet-4@20250514";

export const ERR_RECURSION_LIMIT = "ERR_RECURSION_LIMIT" as const;

type ConsensusVote = "HUMAN" | "NON_HUMAN" | "INCONCLUSIVE";

type ChunkConsensus = {
  gemini: { verdict: ConsensusVote; reason: string };
  claude: { verdict: ConsensusVote; reason: string };
  grok?: { verdict: ConsensusVote; reason: string };
  agreement: boolean;
  decision: "HUMAN_CONFIRMED" | "HITL_TIEBREAKER_REQUIRED" | "NON_HUMAN" | "INCONCLUSIVE";
  halScore: number;
  vote_tally?: {
    HUMAN: number;
    NON_HUMAN: number;
    INCONCLUSIVE: number;
    total: number;
    majorityLabel: string | null;
    no_majority: boolean;
  };
  consensus_mode?: string;
  consensus_providers?: string[];
};

const KeystrokeEventSchema = z.object({
  ts: z.number().finite(),
  key: z.string().min(1),
  type: z.enum(["keydown", "keyup", "input"]).optional(),
  target: z.string().optional(),
  dwellMs: z.number().finite().optional(),
  flightMs: z.number().finite().optional(),
  isBackspace: z.boolean().optional(),
  isSystemEvent: z.boolean().optional(),
  wordsPasted: z.number().int().min(0).optional(),
});

const PulseBodySchema = z
  .object({
    keystrokes: z.array(KeystrokeEventSchema).min(1, "At least one keystroke is required"),
    humanTieBreakerResolved: z.boolean().optional(),
    approvedDelta: z.string().optional(),
  })
  .strict();

export type PulseEngineInput = {
  supabase: SupabaseClient;
  adminSupabase: SupabaseClient;
  /** License / project silo for pillars, lineage, vault metadata. */
  tenantId: string;
  /** Human actor UUID for biometrics, state_beats, incidents. */
  entityId: string;
  /** Correlate logs + Hall/Vault metadata with IDE Pulse (generated in HTTP route if omitted). */
  traceId?: string;
  rawBody: unknown;
  /** Trusted Author BFF rhythm snapshot (no RAG / grammar payload). */
  authorHalTelemetry?: import("@/lib/hal-author-telemetry").AuthorHalTelemetrySnapshot | null;
  forceLomMismatch: boolean;
  lomHarnessEnabled: boolean;
};

export type PulseFullPipelineInput = PulseEngineInput & {
  geminiModelId: string;
  license: PulseLicenseContext;
  /** Logic-drift sensitivity slider (0.1 strict â†’ 0.5 relaxed). Default 0.3. */
  logicDriftEscalationThreshold?: number;
  /** IDE vibe-coding / build-active hints from Pulse HTTP headers. */
  devSession?: import("@/lib/services/dev-session-profile").DevSessionHints;
  /** V3.2 SHARD / CROSS-REF hot session from the HTTP route (Redis fail-open). */
  hotSession?: PulseHotSession;
  /** IDE `.msgf/keys` BYOK for dual-model local gateway. */
  byokGeminiKey?: string | null;
  byokAnthropicKey?: string | null;
  byokXaiKey?: string | null;
  /** Original logic-drift score threshold for human notify (default 0.45). */
  humanNotifyThreshold?: number;
  /** Chrome extension / IDE onboarding â€” shorter CONVERGE timeout with local degrade. */
  isIdePulse?: boolean;
  /** Part B — admin/debug forced CONVERGE tier (x-msgf-converge-tier). */
  forcedConvergeTier?: import("@/lib/services/converge-tier/types").ConvergeTier | null;
  /** Swarm monitor identity (secondary mandate binding). */
  swarmIdentity?: import("@/lib/services/swarm-guard").SwarmAgentIdentity | null;
};

/** CONVERGE dual-model output before ARBITRATE retry / HITL decisions. */
export type PulseConsensusCoreResult = {
  chunks: KeystrokeChunk[];
  verifyResults: Awaited<ReturnType<StateLedgerP4["verifyKeystrokeStream"]>>["results"];
  consensus: ChunkConsensus[];
  allHumanConfirmed: boolean;
  geminiVerdict: ModelVerdict;
  claudeVerdict: ModelVerdict;
  hal: HalScoreResult;
  halScore: number;
  modelsDisagree: boolean;
  recalibrationActive: boolean;
};

export type LineageLedgerRow = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
};

export type PulsePipelineContext = {
  tenantId: string;
  entityId: string;
  keystrokes: KeystrokeEvent[];
  pulseText: string;
  humanTieBreakerResolved: boolean;
  approvedDelta: string | undefined;
  /** True when P1â€“P6 governance baselines exist in `pillar_vectors` for this tenant. */
  isPillarBaselineSet: boolean;
  previousBeats: StateBeatRow[];
  previousRetryCount: number;
  beatsContext: string;
  hotLayerHit: boolean;
  vaultLineage: LineageLedgerRow[];
  lineageRedisHit: boolean;
  p2Roadmap: P2RoadmapConfig;
  vaultP2Prioritized: PrioritizedVaultLineage;
  p2FlowDirective: string;
  vaultCrossRefContext: string;
  /** DEFEND-gate high-priority block from `msgf_rules` / `global_mitigations`. */
  defendConstraints: string;
  globalMitigations: GlobalMitigationsPayload;
  preflight: ShadowPreflightResult;
  /** Part B tier classifier routing profile (when enabled). */
  convergeRoutingProfile?: string;
  convergeTier?: import("@/lib/services/converge-tier/types").ConvergeTier;
};

export type PulseConvergeContext = PulsePipelineContext & {
  legalVersion: string;
  geminiModelId: string;
  license: PulseLicenseContext;
  chunks: KeystrokeChunk[];
  verifyResults: Awaited<ReturnType<StateLedgerP4["verifyKeystrokeStream"]>>["results"];
  consensus: ChunkConsensus[];
  allHumanConfirmed: boolean;
  geminiVerdict: ModelVerdict;
  claudeVerdict: ModelVerdict;
  hal: HalScoreResult;
  halScore: number;
  retryCount: number;
  requiresTieBreaker: boolean;
  tieBreakerProtocolTriggered: boolean;
  modelsDisagree: boolean;
  recalibrationActive: boolean;
  summaryBeat: string;
  storedBeat: StateBeatRow;
  persistableDelta: string;
  momentumIncreased: boolean;
  haltStateSummary?: string;
  /** Part B — T3 disagreement auto-quarantined Vault wins (HITL on ops). */
  tierQuarantine?: TierQuarantineResult;
};

export type PulsePersistResult = {
  vaultNarrativeLogId?: string;
  hallNarrativeLogId?: string;
  ledger: "vault" | "hall" | null;
};

export type PulseFullPipelineOk = {
  kind: "ok";
  /** Tenant / IDE safe â€” no LOM chain-of-thought, chunks, or raw verify rationales. */
  public: Record<string, unknown>;
  /** Full forensic trace â€” persisted to `admin_vault` (service_role only). */
  forensic: Record<string, unknown>;
};

export type PulseFullPipelineBaseline = {
  kind: "baseline_required";
  public: Record<string, unknown>;
  forensic: Record<string, unknown>;
};

export type PulseFullPipelineResult = PulseFullPipelineOk | PulseFullPipelineBaseline;

export type PersistVaultDeltaInput = {
  adminSupabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  deltaAbstraction: string;
  summaryBeat: string;
  legalVersion: string;
  halScore: number;
  bugIndex?: GenealogicalBugIndex;
  narrativeExtra?: Record<string, unknown>;
};

export type PersistHallRejectionInput = {
  adminSupabase: SupabaseClient;
  entityId: string;
  tenantId: string;
  content: string;
  reason: string;
  bugIndex?: GenealogicalBugIndex;
  tier?: "RED" | "YELLOW" | "GREEN";
  lomAttempts?: number;
  testForceMismatch?: boolean;
  actionType?: string;
  narrativeExtra?: Record<string, unknown>;
  hitlStrategyContext?: HitlStrategyGenerationContext;
  /** P7 attribution fields stamped onto msgf_incidents.metadata for trusted-OSS bulk. */
  metadataExtra?: Record<string, unknown> | null;
};

export class PulseEngine {
  /**
   * V3.2 full pipeline: GATE â†’ CONVERGE â†’ ARBITRATE â†’ PERSIST (see `pulse-pipeline/`).
   */
  async runFullPipeline(input: PulseFullPipelineInput): Promise<PulseFullPipelineResult> {
    return runV32PulsePipeline(this, input);
  }


  async runThroughDefend(
    input: PulseEngineInput & {
      devSession?: import("@/lib/services/dev-session-profile").DevSessionHints;
    },
    isPillarBaselineSet = false
  ): Promise<PulsePipelineContext> {
    const gated = this.gate(input.rawBody);
    const cross = await this.crossRef({
      supabase: input.supabase,
      adminSupabase: input.adminSupabase,
      tenantId: input.tenantId,
      entityId: input.entityId,
      pulseText: gated.pulseText,
      keystrokes: gated.keystrokes,
      activeFilePath: input.devSession?.activeFilePath ?? undefined,
      applyContextBudget: true,
    });
    const preflight = await this.defend({
      supabase: input.supabase,
      adminSupabase: input.adminSupabase,
      tenantId: input.tenantId,
      entityId: input.entityId,
      keystrokes: gated.keystrokes,
      pulseText: gated.pulseText,
      forceLomMismatch: input.forceLomMismatch,
      lomHarnessEnabled: input.lomHarnessEnabled,
      crossRefVaultLineage: cross.vaultLineage,
      globalMitigations: cross.globalMitigations,
      defendConstraints: cross.defendConstraints,
    });

    return {
      tenantId: input.tenantId,
      entityId: input.entityId,
      keystrokes: gated.keystrokes,
      pulseText: gated.pulseText,
      humanTieBreakerResolved: gated.humanTieBreakerResolved,
      approvedDelta: gated.approvedDelta,
      isPillarBaselineSet,
      previousBeats: cross.previousBeats,
      previousRetryCount: cross.previousRetryCount,
      beatsContext: cross.beatsContext,
      hotLayerHit: cross.hotLayerHit,
      vaultLineage: cross.vaultLineage,
      lineageRedisHit: cross.lineageRedisHit,
      p2Roadmap: cross.p2Roadmap,
      vaultP2Prioritized: cross.vaultP2Prioritized,
      p2FlowDirective: cross.p2FlowDirective,
      vaultCrossRefContext: cross.vaultCrossRefContext,
      defendConstraints: cross.defendConstraints,
      globalMitigations: cross.globalMitigations,
      preflight,
    };
  }

  /**
   * CONVERGE (core) â€” dual-model votes + HAL scoring (no ARBITRATE retry yet).
   */
  async runConsensusCore(
    ctx: PulsePipelineContext & {
      supabase: SupabaseClient;
      geminiModelId: string;
      byokGeminiKey?: string;
      byokAnthropicKey?: string;
      byokXaiKey?: string;
      convergeRoutingProfile?: string;
      logicDriftScore?: number;
      humanNotifyThreshold?: number;
    }
  ): Promise<PulseConsensusCoreResult> {
    const p4 = new StateLedgerP4(ctx.supabase, ctx.tenantId);
    const { chunks, results: verifyResults } = await p4.verifyKeystrokeStream(
      ctx.entityId,
      ctx.keystrokes
    );

    const momentumRetryForPrompt = ctx.previousRetryCount;
    const chunkForConsensus = chunkKeystrokeStream(ctx.keystrokes);
    const useByokConverge = Boolean(
      ctx.byokGeminiKey?.trim() && ctx.byokAnthropicKey?.trim()
    );

    const routingProfile =
      ctx.convergeRoutingProfile ??
      resolveConvergeRoutingProfile(
        useByokConverge ? "individual_byok" : "corporate_system",
        ctx.geminiModelId
      );
    const contentHash = computeConvergeContentHash({
      pulseText: ctx.pulseText,
      beatsContext: ctx.beatsContext,
      vaultCrossRefFingerprint: ctx.vaultCrossRefContext,
    });

    const toCached = (c: ChunkConsensus): ConvergeCachedChunk => ({
      gemini: { verdict: c.gemini.verdict, reason: c.gemini.reason },
      claude: { verdict: c.claude.verdict, reason: c.claude.reason },
      grok: c.grok ? { verdict: c.grok.verdict, reason: c.grok.reason } : undefined,
      agreement: c.agreement,
      decision: c.decision,
      halScore: c.halScore,
      vote_tally: c.vote_tally,
      consensus_mode: c.consensus_mode,
      consensus_providers: c.consensus_providers,
    });

    const fromCached = (c: ConvergeCachedChunk): ChunkConsensus => ({
      gemini: {
        verdict: c.gemini.verdict as ConsensusVote,
        reason: c.gemini.reason,
      },
      claude: {
        verdict: c.claude.verdict as ConsensusVote,
        reason: c.claude.reason,
      },
      grok: c.grok
        ? { verdict: c.grok.verdict as ConsensusVote, reason: c.grok.reason }
        : undefined,
      agreement: c.agreement,
      decision: c.decision as ChunkConsensus["decision"],
      halScore: c.halScore,
      vote_tally: c.vote_tally,
      consensus_mode: c.consensus_mode,
      consensus_providers: c.consensus_providers,
    });

    const cacheResult = await getOrSetConvergeCache({
      tenantId: ctx.tenantId,
      contentHash,
      routingProfile,
      entityId: ctx.entityId,
      projectOrigin: undefined,
      packetCount: chunkForConsensus.length,
      runConverge: async () => {
        const freshConsensus = await Promise.all(
          chunkForConsensus.map((c) =>
            this.runConsensusForChunk(c, ctx.beatsContext, ctx.geminiModelId, momentumRetryForPrompt, {
              tenantId: ctx.tenantId,
              p2FlowDirective: ctx.p2FlowDirective,
              vaultCrossRefContext: ctx.vaultCrossRefContext,
              defendConstraints: ctx.defendConstraints,
              byokGeminiKey: useByokConverge ? ctx.byokGeminiKey : undefined,
              byokAnthropicKey: useByokConverge ? ctx.byokAnthropicKey : undefined,
              byokXaiKey: ctx.byokXaiKey,
            })
          )
        );
        const cachedChunks = freshConsensus.map(toCached);
        return {
          resolution: buildConvergeResolutionString(cachedChunks),
          agreementScore: computeConvergeAgreementScore(cachedChunks),
          consensus: cachedChunks,
        };
      },
    });

    const consensus = cacheResult.consensus.map(fromCached);
    if (cacheResult.cacheHit) {
      console.info(
        `[converge-cache] HIT tenant=${ctx.tenantId} profile=${routingProfile} agreement=${cacheResult.agreementScore.toFixed(2)}`
      );
    }

    const allHumanConfirmed = consensus.every((c) => c.decision === "HUMAN_CONFIRMED");
    const geminiVerdict = aggregateVerdict(consensus.map((c) => c.gemini.verdict));
    const claudeVerdict = aggregateVerdict(consensus.map((c) => c.claude.verdict));

    const biometricProfile = await getBiometricProfile(ctx.supabase, ctx.entityId);
    const hal = calculateHalScore({
      biometric: {
        userId: ctx.entityId,
        keystrokes: ctx.keystrokes,
        textSample: ctx.pulseText,
        profile: biometricProfile,
      },
      linguistic: {
        currentText: ctx.pulseText,
        historicalBeats: ctx.previousBeats.map((b) => ({
          beat_text: b.beat_text,
          sequence_index: b.sequence_index,
        })),
        geminiVerdict,
        claudeVerdict,
      },
      integrity: {
        currentText: ctx.pulseText,
        geminiReason: consensus.map((c) => c.gemini.reason).join(" | "),
        claudeReason: consensus.map((c) => c.claude.reason).join(" | "),
      },
    });

    return {
      chunks,
      verifyResults,
      consensus,
      allHumanConfirmed,
      geminiVerdict,
      claudeVerdict,
      hal,
      halScore: hal.halScore,
      modelsDisagree: geminiVerdict !== claudeVerdict,
      recalibrationActive: hal.flags.baselineTrainingActive,
    };
  }

  /**
   * ARBITRATE â€” retry ceiling, HITL tie-breaker, halt-state, state_beats append.
   */
  async runArbitratePhase(
    ctx: PulsePipelineContext & {
      supabase: SupabaseClient;
      adminSupabase: SupabaseClient;
      legalVersion: string;
      geminiModelId: string;
      license: PulseLicenseContext;
      logicDriftScore?: number;
      humanNotifyThreshold?: number;
    },
    core: PulseConsensusCoreResult
  ): Promise<PulseConvergeContext> {
    const {
      chunks,
      verifyResults,
      consensus,
      allHumanConfirmed,
      geminiVerdict,
      claudeVerdict,
      hal,
    } = core;
    const halScore = core.halScore;
    const recalibrationActive = core.recalibrationActive;
    const modelsDisagree = core.modelsDisagree;
    const p4 = new StateLedgerP4(ctx.supabase, ctx.tenantId);
    const retryCount =
      halScore < 70 && modelsDisagree ? ctx.previousRetryCount + 1 : ctx.previousRetryCount;
    const momentumIncreased = retryCount > ctx.previousRetryCount;
    const effectiveMomentumRetry = Math.max(retryCount, ctx.previousRetryCount);
    const tieBreakerProtocolTriggered = retryCount > PULSE_RECURSION_MAX_RETRY;

    let tierQuarantine: TierQuarantineResult | undefined;
    if (modelsDisagree && ctx.convergeTier === "TIER_3") {
      const lineageIds = ctx.vaultLineage.map((r) => r.id).filter(Boolean);
      const companyId =
        typeof ctx.vaultLineage[0]?.metadata?.company_id === "string"
          ? String(ctx.vaultLineage[0].metadata.company_id)
          : null;
      const projectOrigin =
        typeof ctx.vaultLineage[0]?.metadata?.project_origin === "string"
          ? String(ctx.vaultLineage[0].metadata.project_origin)
          : null;
      tierQuarantine = await quarantineVaultFromTierDisagreement(ctx.adminSupabase, {
        tenantId: ctx.tenantId,
        companyId,
        projectOrigin,
        vectorIds: lineageIds.length ? lineageIds : undefined,
        finalTier: "TIER_3",
        entityId: ctx.entityId,
      }).catch((e) => {
        console.warn("[PulseEngine] T3 tier quarantine skipped:", e);
        return {
          quarantined: false,
          vectorIds: [] as string[],
          reason: "quarantine_error",
        };
      });

      if (tierQuarantine.quarantined) {
        const quarantinePath = resolveRemediationFilePath({
          tenantId: ctx.tenantId,
          entityId: ctx.entityId,
        });
        await tripRemediationCircuitBreaker({
          admin: ctx.adminSupabase,
          tenantId: ctx.tenantId,
          filePath: quarantinePath,
          bugIndex: PULSE_BUG_INDEX.hallHitlRequired,
          reason: `T3 dual-CONVERGE disagreement quarantined ${tierQuarantine.vectorIds.length} Vault win(s)`,
          source: "pulse_arbitrate_tier_quarantine",
        }).catch((e) => {
          console.warn("[PulseEngine] T3 quarantine circuit trip skipped:", e);
        });
      }
    }

    const requiresTieBreaker =
      isTriConsensusEnabled() || consensus.some((c) => c.vote_tally)
        ? shouldNotifyHuman({
            logicDriftScore: ctx.logicDriftScore ?? 0,
            humanNotifyThreshold: resolveHumanNotifyThreshold(
              ctx.humanNotifyThreshold != null ? String(ctx.humanNotifyThreshold) : null
            ),
            voteOk: consensus.every((c) => c.decision !== "HITL_TIEBREAKER_REQUIRED"),
            majorityLabel:
              (consensus[0]?.vote_tally?.majorityLabel as
                | "HUMAN"
                | "NON_HUMAN"
                | "INCONCLUSIVE"
                | null) ?? (allHumanConfirmed ? "HUMAN" : null),
            securityNonHuman:
              geminiVerdict === "NON_HUMAN" ||
              claudeVerdict === "NON_HUMAN" ||
              consensus.some((c) => c.grok?.verdict === "NON_HUMAN"),
            tierQuarantined: Boolean(tierQuarantine?.quarantined),
            tieBreakerProtocolTriggered,
            halScore,
            allHumanConfirmed,
          })
        : !allHumanConfirmed ||
          halScore < 70 ||
          (halScore < 70 && recalibrationActive) ||
          tieBreakerProtocolTriggered ||
          Boolean(tierQuarantine?.quarantined);

    if (retryCount > PULSE_RECURSION_MAX_RETRY) {
      let persistableDeltaEarly =
        ctx.approvedDelta ||
        (await this.buildDeltaAbstraction({
          pulseText: ctx.pulseText,
          consensus,
          halScore,
          geminiModelId: ctx.geminiModelId,
          momentumRetryCount: effectiveMomentumRetry,
          momentumIncreased,
          p2FlowDirective: ctx.p2FlowDirective,
          vaultCrossRefContext: ctx.vaultCrossRefContext,
          defendConstraints: ctx.defendConstraints,
        }));

      let haltStateSummary: string | undefined;
      if (retryCount >= PULSE_HALT_STATE_RETRY) {
        haltStateSummary = await this.generateHaltStateSummary({
          pulseText: ctx.pulseText,
          consensus,
          halScore,
          retryCount,
          geminiModelId: ctx.geminiModelId,
          beatsContext: ctx.beatsContext,
          preflight: ctx.preflight,
          geminiVerdict,
          claudeVerdict,
          modelsDisagree,
          allHumanConfirmed,
          p2FlowDirective: ctx.p2FlowDirective,
          vaultCrossRefContext: ctx.vaultCrossRefContext,
          defendConstraints: ctx.defendConstraints,
        });
        persistableDeltaEarly = this.wrapPersistableWithHalt(
          persistableDeltaEarly,
          haltStateSummary,
          retryCount
        );
      }

      await this.persistHitlToHall({
        adminSupabase: ctx.adminSupabase,
        entityId: ctx.entityId,
        tenantId: ctx.tenantId,
        content: persistableDeltaEarly,
        reason: `LOM recursion guard: retry_count=${retryCount} exceeds ${PULSE_RECURSION_MAX_RETRY}.`,
        bugIndex: PULSE_BUG_INDEX.hallLomRecursion,
        lomAttempts: retryCount,
        actionType: "PULSE_HALL_RECURSION",
        narrativeExtra: buildArbitrateNarrativeExtra({
          keystrokesPlainText: ctx.pulseText,
          geminiVerdict,
          claudeVerdict,
          modelsDisagree,
          allHumanConfirmed,
          haltStateSummary,
        }),
      });

      const recursionPath = resolveRemediationFilePath({
        tenantId: ctx.tenantId,
        entityId: ctx.entityId,
      });
      await tripRemediationCircuitBreaker({
        admin: ctx.adminSupabase,
        tenantId: ctx.tenantId,
        filePath: recursionPath,
        bugIndex: PULSE_BUG_INDEX.hallLomRecursion,
        reason: `LOM recursion guard exceeded (${retryCount} > ${PULSE_RECURSION_MAX_RETRY})`,
        source: "pulse_arbitrate_recursion",
      }).catch((e) => {
        console.warn("[PulseEngine] recursion circuit trip skipped:", e);
      });

      throw new PulseHttpError(403, {
        err: ERR_RECURSION_LIMIT,
        error: "CONVERGE recursion guard: retry count exceeded.",
        retry_count: retryCount,
        lineage: {
          instance: LINEAGE_INSTANCE,
          bug_index: PULSE_BUG_INDEX.hallLomRecursion,
        },
        ledger: "hall",
      });
    }

    const updatedProfile = await upsertBiometricProfileFromPulse({
      supabase: ctx.supabase,
      userId: ctx.entityId,
      keystrokes: ctx.keystrokes,
    });

    let persistableDelta =
      ctx.approvedDelta ||
      (await this.buildDeltaAbstraction({
        pulseText: ctx.pulseText,
        consensus,
        halScore,
        geminiModelId: ctx.geminiModelId,
        momentumRetryCount: effectiveMomentumRetry,
        momentumIncreased,
        p2FlowDirective: ctx.p2FlowDirective,
        vaultCrossRefContext: ctx.vaultCrossRefContext,
        defendConstraints: ctx.defendConstraints,
      }));

    let haltStateSummary: string | undefined;
    if (retryCount >= PULSE_HALT_STATE_RETRY && requiresTieBreaker) {
      haltStateSummary = await this.generateHaltStateSummary({
        pulseText: ctx.pulseText,
        consensus,
        halScore,
        retryCount,
        geminiModelId: ctx.geminiModelId,
        beatsContext: ctx.beatsContext,
        preflight: ctx.preflight,
        geminiVerdict,
        claudeVerdict,
        modelsDisagree,
        allHumanConfirmed,
        p2FlowDirective: ctx.p2FlowDirective,
        vaultCrossRefContext: ctx.vaultCrossRefContext,
        defendConstraints: ctx.defendConstraints,
      });
      persistableDelta = this.wrapPersistableWithHalt(
        persistableDelta,
        haltStateSummary,
        retryCount
      );
    }

    const summaryBeat = `Pulse ${allHumanConfirmed ? "HUMAN" : "FLAGGED"}; chunks=${chunks.length}; hal=${halScore}${haltStateSummary ? "; halt_state=ready" : ""}`;

    const storedBeat = await p4.appendBeat(ctx.entityId, summaryBeat, {
      legalVersion: ctx.legalVersion,
      label: requiresTieBreaker ? "pulse_tiebreaker_required" : "pulse_human",
      metadata: {
        chunkCount: chunks.length,
        consensus_summary: {
          gemini: geminiVerdict,
          claude: claudeVerdict,
          grok: consensus[0]?.grok?.verdict ?? null,
          vote_tally: consensus[0]?.vote_tally ?? null,
          consensus_mode: consensus[0]?.consensus_mode ?? "DUAL",
          consensus_providers: consensus[0]?.consensus_providers ?? ["anthropic", "google"],
          all_human_confirmed: allHumanConfirmed,
          models_disagree: modelsDisagree,
        },
        hal_subscores: hal.subScores,
        hal_weights: hal.weights,
        hal_flags: hal.flags,
        hal_score: halScore,
        retry_count: retryCount,
        momentum_increased: momentumIncreased,
        tie_breaker_protocol_triggered: tieBreakerProtocolTriggered,
        human_tiebreaker_required: requiresTieBreaker,
        human_tiebreaker_resolved: ctx.humanTieBreakerResolved,
        block_user: false,
        ewma_rhythm: updatedProfile.rhythm_hash,
        ewma_speed: updatedProfile.ewma_speed,
        recalibration_active: recalibrationActive,
        defend_preflight_tier: ctx.preflight.tier,
        vault_lineage_hits: ctx.vaultLineage.length,
        vault_p2_aligned: ctx.vaultP2Prioritized.aligned.length,
        vault_p2_contradicts_roadmap: ctx.vaultP2Prioritized.contradicts.length,
        p2_roadmap_version: ctx.p2Roadmap.version,
        lineage_redis_hit: ctx.lineageRedisHit,
        license_tenant: ctx.license.tenantId,
        license_tier: ctx.license.tierId,
        ...(haltStateSummary ? { halt_state_summary: haltStateSummary } : {}),
        ...attachSourceAuditToBeatMetadata(
          {},
          {
            tenant_id: ctx.tenantId,
            entity_id: ctx.entityId,
            trace_id: `arbitrate:${ctx.entityId}`,
            decision_kind: "defend",
            routing: "converge",
            defend_tier: ctx.preflight.tier,
            defend_reason: ctx.preflight.reason,
            sources: [
              ...(ctx.preflight.scoredHits ?? []),
              ...(ctx.preflight.prunedHits ?? []),
            ],
            outcome: "unknown",
          }
        ),
      },
    });

    return {
      ...ctx,
      legalVersion: ctx.legalVersion,
      geminiModelId: ctx.geminiModelId,
      license: ctx.license,
      chunks,
      verifyResults,
      consensus,
      allHumanConfirmed,
      geminiVerdict,
      claudeVerdict,
      hal,
      halScore,
      retryCount,
      requiresTieBreaker,
      tieBreakerProtocolTriggered,
      modelsDisagree,
      recalibrationActive,
      summaryBeat,
      storedBeat,
      persistableDelta,
      momentumIncreased,
      haltStateSummary,
      tierQuarantine,
    };
  }

  /**
   * CONVERGE â€” dual-model consensus (Gemini + Claude shadow), then ARBITRATE.
   */
  async converge(
    ctx: PulsePipelineContext & {
      supabase: SupabaseClient;
      adminSupabase: SupabaseClient;
      legalVersion: string;
      geminiModelId: string;
      license: PulseLicenseContext;
      convergeCredentialMode:
        | "corporate_system"
        | "individual_perpetual_platform"
        | "individual_byok";
      byokGeminiKey?: string;
      byokAnthropicKey?: string;
      byokXaiKey?: string;
      logicDriftScore?: number;
      humanNotifyThreshold?: number;
    }
  ): Promise<PulseConvergeContext> {
    const core = await this.runConsensusCore({
      ...ctx,
      convergeRoutingProfile: resolveConvergeRoutingProfile(
        ctx.convergeCredentialMode,
        ctx.geminiModelId
      ),
    });
    return this.runArbitratePhase(ctx, core);
  }

  /**
   * PERSIST â€” Vault (consensus OK) or Hall (consensus fail / LOM disagreement / HITL).
   * Refreshes hot-layer active slice; every narrative log carries 1.1.1 bug_index.
   */
  async persist(params: {
    adminSupabase: SupabaseClient;
    converged: PulseConvergeContext;
    pulseTraceId: string;
    rawBody?: unknown;
  }): Promise<PulsePersistResult> {
    const c = params.converged;
    const consensusFailed = !c.allHumanConfirmed;
    const lomDisagreement = c.modelsDisagree;
    const canPersistVault =
      c.allHumanConfirmed &&
      !lomDisagreement &&
      !c.tierQuarantine?.quarantined &&
      (!c.requiresTieBreaker || c.humanTieBreakerResolved);

    let vaultNarrativeLogId: string | undefined;
    let hallNarrativeLogId: string | undefined;
    let ledger: "vault" | "hall" | null = null;

    if (canPersistVault) {
      const vaultResult = await this.persistConsensusToVault({
        adminSupabase: params.adminSupabase,
        entityId: c.entityId,
        tenantId: c.tenantId,
        deltaAbstraction: c.persistableDelta,
        summaryBeat: c.summaryBeat,
        legalVersion: c.legalVersion,
        halScore: c.halScore,
        bugIndex: PULSE_BUG_INDEX.vaultConsensusOk,
        narrativeExtra: { pulse_trace_id: params.pulseTraceId },
      });
      vaultNarrativeLogId = vaultResult.narrativeLogId;
      ledger = "vault";

      const vaultPath = resolveRemediationFilePath({
        rawBody: params.rawBody,
        tenantId: c.tenantId,
        entityId: c.entityId,
        pulseTraceId: params.pulseTraceId,
      });
      await recordRemediationSuccess({
        admin: params.adminSupabase,
        tenantId: c.tenantId,
        filePath: vaultPath,
        bugIndex: PULSE_BUG_INDEX.vaultConsensusOk,
      }).catch((e) => {
        console.warn("[PulseEngine] remediation success reset skipped:", e);
      });
    } else {
      const bugIndex = c.tierQuarantine?.quarantined
        ? PULSE_BUG_INDEX.hallHitlRequired
        : consensusFailed
        ? PULSE_BUG_INDEX.hallConsensusFailed
        : lomDisagreement
          ? PULSE_BUG_INDEX.hallLomDisagreement
          : PULSE_BUG_INDEX.hallHitlRequired;

      const haltNote = c.haltStateSummary
        ? " Halt-State Summary attached for Human Tie-Breaker."
        : "";
      const reason = c.tierQuarantine?.quarantined
        ? `T3 dual-CONVERGE disagreement — Vault wins quarantined (${c.tierQuarantine.vectorIds.length}); HITL required.${haltNote}`
        : consensusFailed
        ? `Consensus failed (gemini=${c.geminiVerdict}, claude=${c.claudeVerdict}).${haltNote}`
        : lomDisagreement
          ? `LOM model disagreement (gemini=${c.geminiVerdict}, claude=${c.claudeVerdict}, hal=${c.halScore}).${haltNote}`
          : `HITL tie-breaker required (hal=${c.halScore}, retry=${c.retryCount}).${haltNote}`;

      const hallResult = await this.persistHitlToHall({
        adminSupabase: params.adminSupabase,
        entityId: c.entityId,
        tenantId: c.tenantId,
        content: c.persistableDelta,
        reason,
        bugIndex,
        lomAttempts: c.retryCount,
        actionType: c.tierQuarantine?.quarantined
          ? "PULSE_HALL_HITL"
          : consensusFailed
          ? "PULSE_HALL_CONSENSUS_FAIL"
          : lomDisagreement
            ? "PULSE_HALL_LOM_DISAGREE"
            : "PULSE_HALL_HITL",
        metadataExtra: incidentAttributionMetadataFromHits(
          [
            ...(c.preflight.scoredHits ?? []),
            ...(c.preflight.contextHits ?? []),
            ...(c.preflight.prunedHits ?? []),
          ],
          c.preflight.reason
        ),
        narrativeExtra: {
          ...buildArbitrateNarrativeExtra({
            keystrokesPlainText: c.pulseText,
            geminiVerdict: c.geminiVerdict,
            claudeVerdict: c.claudeVerdict,
            modelsDisagree: c.modelsDisagree,
            allHumanConfirmed: c.allHumanConfirmed,
            haltStateSummary: c.haltStateSummary,
          }),
          pulse_trace_id: params.pulseTraceId,
          ...(c.tierQuarantine
            ? {
                tier_quarantine: c.tierQuarantine,
                converge_tier: c.convergeTier ?? "TIER_3",
              }
            : {}),
        },
        hitlStrategyContext: isHitlTiebreakerBugIndex(bugIndex)
          ? {
              geminiModelId: c.geminiModelId,
              pulseText: c.pulseText,
              reason,
              halScore: c.halScore,
              retryCount: c.retryCount,
              geminiVerdict: c.geminiVerdict,
              claudeVerdict: c.claudeVerdict,
              modelsDisagree: c.modelsDisagree,
              haltStateSummary: c.haltStateSummary,
              persistableDelta: c.persistableDelta,
              p2Roadmap: c.p2Roadmap,
              p2FlowDirective: c.p2FlowDirective,
              vaultCrossRefContext: c.vaultCrossRefContext,
              vaultP2Prioritized: c.vaultP2Prioritized,
            }
          : undefined,
      });
      hallNarrativeLogId = hallResult.narrativeLogId;
      ledger = "hall";

      const hallPath = resolveRemediationFilePath({
        rawBody: params.rawBody,
        tenantId: c.tenantId,
        entityId: c.entityId,
        pulseTraceId: params.pulseTraceId,
      });
      const circuit = await recordRemediationFailure({
        admin: params.adminSupabase,
        tenantId: c.tenantId,
        filePath: hallPath,
        bugIndex,
        reason,
        source: consensusFailed
          ? "pulse_consensus_failed"
          : lomDisagreement
            ? "pulse_lom_disagreement"
            : "pulse_hitl_required",
      });
      if (circuit.tripped) {
        console.info("[PulseEngine] remediation circuit breaker:", circuit.message);
      }
    }

    const refreshedBeats = [...c.previousBeats, c.storedBeat].slice(-32);
    await setActiveSlice({
      entityId: c.entityId,
      previousBeats: refreshedBeats,
      previousRetryCount: c.retryCount,
    });

    // P7: durable source audit + reputation (non-blocking)
    {
      const hits: SourceHit[] = [
        ...(c.preflight.scoredHits ?? []),
        ...(c.preflight.prunedHits ?? []),
      ];
      const outcome =
        ledger === "vault"
          ? "persist_vault"
          : ledger === "hall"
            ? "persist_hall"
            : "unknown";
      recordSourceAudit(params.adminSupabase, {
        tenant_id: c.tenantId,
        entity_id: c.entityId,
        trace_id: params.pulseTraceId,
        pulse_beat_id: c.storedBeat?.id ?? null,
        decision_kind: "converge",
        routing: c.convergeRoutingProfile ?? "converge",
        defend_tier: c.preflight.tier,
        defend_reason: c.preflight.reason,
        sources: hits,
        outcome,
      });
      applyReputationOutcome(params.adminSupabase, c.tenantId, hits, {
        kind: ledger === "vault" ? "good" : "bad",
        highDrift: ledger === "hall",
        driftScore: typeof c.halScore === "number" ? c.halScore : null,
      });
    }

    return { vaultNarrativeLogId, hallNarrativeLogId, ledger };
  }

  /**
   * Global Approval Gate â€” routes LogicDelta to `local_state_cache` or `vault_core` (pillar_vectors).
   */
  async persistLogicDeltaWithGate(input: {
    adminSupabase: SupabaseClient;
    entityId: string;
    tenantId: string;
    isAdmin?: boolean;
    globalize?: boolean;
    delta: LogicDelta;
    vaultPersist?: () => Promise<ConstraintLedgerPersistResult>;
  }): Promise<PersistLogicDeltaGateResult> {
    const tenantId = input.tenantId.trim();
    const entityId = input.entityId.trim();
    const globalize = input.globalize === true;
    const vaultCore = vaultCoreWriteForTenant(tenantId, globalize);
    const selfHeal = input.delta.source === "self_heal";

    if (selfHeal) {
      const cached = await saveLogicDeltaToLocalCache(input.adminSupabase, {
        ...input.delta,
        tenantId,
        entityId,
        globalize: false,
      });
      return {
        promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS,
        local_cache_id: cached.cacheId,
      };
    }

    const needsGlobalPromotion = globalize || vaultCore;
    if (needsGlobalPromotion) {
      const gate = assertGlobalWriteAllowed({
        tenantId,
        isAdmin: input.isAdmin === true,
        target: globalize ? "global_msgf_rules" : "vault_core",
        globalize,
      });

      if (!gate.allowed) {
        const cached = await saveLogicDeltaToLocalCache(input.adminSupabase, {
          ...input.delta,
          tenantId,
          entityId,
          globalize,
        });
        return {
          promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
          local_cache_id: cached.cacheId,
        };
      }
    }

    if (!input.vaultPersist) {
      return { promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS };
    }

    const vault = await input.vaultPersist();
    return {
      promotion_status: GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS,
      vaultNarrativeLogId: vault.narrativeLogId ?? undefined,
    };
  }

  async persistConsensusToVault(
    input: PersistVaultDeltaInput & { isAdmin?: boolean; globalize?: boolean }
  ): Promise<ConstraintLedgerPersistResult & { promotion_status?: GlobalPromotionStatus }> {
    const gateResult = await this.persistLogicDeltaWithGate({
      adminSupabase: input.adminSupabase,
      entityId: input.entityId,
      tenantId: input.tenantId,
      isAdmin: input.isAdmin,
      globalize: input.globalize,
      delta: {
        tenantId: input.tenantId,
        entityId: input.entityId,
        content: input.deltaAbstraction,
        summaryBeat: input.summaryBeat,
        bugIndex: input.bugIndex ?? PULSE_BUG_INDEX.vaultConsensusOk,
        source: "pulse_converge",
        globalize: input.globalize,
      },
      vaultPersist: () =>
        persistToVault({
          supabase: input.adminSupabase,
          entityId: input.entityId,
          tenantId: input.tenantId,
          content: input.deltaAbstraction,
          bugIndex: input.bugIndex ?? PULSE_BUG_INDEX.vaultConsensusOk,
          summaryBeat: input.summaryBeat,
          legalVersion: input.legalVersion,
          halScore: input.halScore,
          actionType: "PULSE_VAULT_CONVERGE",
          narrativeExtra: input.narrativeExtra,
        }),
    });

    return {
      narrativeLogId: gateResult.vaultNarrativeLogId,
      promotion_status: gateResult.promotion_status,
    };
  }

  async persistHitlToHall(
    input: PersistHallRejectionInput
  ): Promise<ConstraintLedgerPersistResult & { incidentId?: string }> {
    const bugIndex = input.bugIndex ?? PULSE_BUG_INDEX.hallHitlRequired;

    const result = await persistToHall({
      supabase: input.adminSupabase,
      entityId: input.entityId,
      tenantId: input.tenantId,
      content: input.content,
      bugIndex,
      reason: input.reason,
      tier: input.tier ?? "YELLOW",
      lomAttempts: input.lomAttempts,
      testForceMismatch: input.testForceMismatch,
      actionType: input.actionType ?? "PULSE_HALL_HITL",
      severity: "Warning",
      narrativeExtra: input.narrativeExtra,
    });

    const incidentId = await insertMsgfArbitrateIncident({
      adminSupabase: input.adminSupabase,
      userId: input.entityId,
      narrativeLogId: result.narrativeLogId,
      bugIndex,
      hitlStrategyContext: input.hitlStrategyContext,
      scope: { tenantId: input.tenantId, entityId: input.entityId },
      metadataExtra: input.metadataExtra ?? null,
    });

    return incidentId ? { ...result, incidentId } : result;
  }

  /**
   * Writes a Vault **Arbitration Beat** before admin incident resolution completes.
   * Surfaces `human_reasoning` + `final_fix_applied` for P2 Cross-Ref on future Pulses.
   */
  async writeArbitrationBeat(input: {
    adminSupabase: SupabaseClient;
    entityId: string;
    tenantId: string;
    incidentId: string;
    bugIndex: GenealogicalBugIndex;
    humanReasoning: string;
    finalFixApplied: string;
    remediationStrategyLabel?: string;
    globalMitigation?: boolean;
    mitigationAction?: MitigationAction;
    isAdmin?: boolean;
  }): Promise<ConstraintLedgerPersistResult & { promotion_status?: GlobalPromotionStatus; local_cache_id?: string }> {
    const humanReasoning = input.humanReasoning.trim();
    const finalFixApplied = input.finalFixApplied.trim();
    const strategyLabel = input.remediationStrategyLabel?.trim();

    const summaryBeat = strategyLabel
      ? `Arbitration Beat â€” ${strategyLabel}`
      : "Arbitration Beat â€” operator resolution";

    const content = [
      "[P2 Cross-Ref â€” human-corrected arbitration_beat]",
      `human_reasoning: ${humanReasoning || "(not provided)"}`,
      `final_fix_applied: ${finalFixApplied || "(not provided)"}`,
      ...(strategyLabel ? [`remediation_strategy_label: ${strategyLabel}`] : []),
      ...(input.globalMitigation ? ["mitigation_action: Global Fix", "global_mitigation: true"] : []),
      `incident_id: ${input.incidentId}`,
      `genealogical_instance: ${input.bugIndex.level_1_1_1_instance}`,
    ].join("\n");

    const gate = await this.persistLogicDeltaWithGate({
      adminSupabase: input.adminSupabase,
      entityId: input.entityId,
      tenantId: input.tenantId,
      isAdmin: input.isAdmin,
      globalize: input.globalMitigation,
      delta: {
        tenantId: input.tenantId,
        entityId: input.entityId,
        content,
        summaryBeat,
        bugIndex: PULSE_BUG_INDEX.adminArbitrationBeat,
        source: "arbitration",
        globalize: input.globalMitigation,
        metadata: {
          beat_kind: "arbitration_beat",
          incident_id: input.incidentId,
          source_bug_index: input.bugIndex,
        },
      },
      vaultPersist: () =>
        persistToVault({
          supabase: input.adminSupabase,
          entityId: input.entityId,
          tenantId: input.tenantId,
          content,
          bugIndex: PULSE_BUG_INDEX.adminArbitrationBeat,
          summaryBeat,
          legalVersion: CURRENT_LEGAL_VERSION,
          halScore: 100,
          actionType: "ARBITRATION_BEAT",
          narrativeExtra: {
            beat_kind: "arbitration_beat",
            p2_cross_ref_priority: true,
            human_reasoning: humanReasoning,
            final_fix_applied: finalFixApplied,
            admin_arbitration: true,
            incident_id: input.incidentId,
            source_bug_index: input.bugIndex,
            ...(strategyLabel ? { remediation_strategy_label: strategyLabel } : {}),
            ...(input.globalMitigation
              ? {
                  global_mitigation: true,
                  mitigation_action: input.mitigationAction ?? { kind: "Global Fix" },
                }
              : {}),
          },
        }),
    });

    return {
      narrativeLogId: gate.vaultNarrativeLogId,
      promotion_status: gate.promotion_status,
      local_cache_id: gate.local_cache_id,
    };
  }

  /**
   * Dedicated Vault education row so P2 Cross-Ref / Roadmap layers prioritize the operator fix.
   */
  async writeP2EducationVaultEntry(input: {
    adminSupabase: SupabaseClient;
    entityId: string;
    tenantId: string;
    incidentId: string;
    bugIndex: GenealogicalBugIndex;
    humanReasoning: string;
    finalFixApplied: string;
    remediationStrategyLabel?: string;
    globalMitigation?: boolean;
    mitigationAction?: MitigationAction;
    isAdmin?: boolean;
  }): Promise<ConstraintLedgerPersistResult & { promotion_status?: GlobalPromotionStatus; local_cache_id?: string }> {
    const humanReasoning = input.humanReasoning.trim();
    const finalFixApplied = input.finalFixApplied.trim();
    const strategyLabel = input.remediationStrategyLabel?.trim();

    const summaryBeat = input.globalMitigation
      ? "P2 education â€” global mitigation (all future sessions)"
      : "P2 education â€” session resolution";

    const content = [
      "[P2 Roadmap education vault â€” human-corrected]",
      "p2_roadmap_education: true",
      "arbitration_beat: true",
      `human_reasoning: ${humanReasoning || "(not provided)"}`,
      `final_fix_applied: ${finalFixApplied || "(not provided)"}`,
      ...(strategyLabel ? [`remediation_strategy_label: ${strategyLabel}`] : []),
      ...(input.mitigationAction?.pillar ? [`pillar: ${input.mitigationAction.pillar}`] : []),
      ...(input.globalMitigation
        ? ["mitigation_action: Global Fix", "apply_to_future_sessions: true"]
        : ["mitigation_action: Session Only"]),
      `incident_id: ${input.incidentId}`,
      `genealogical_instance: ${input.bugIndex.level_1_1_1_instance}`,
    ].join("\n");

    const gate = await this.persistLogicDeltaWithGate({
      adminSupabase: input.adminSupabase,
      entityId: input.entityId,
      tenantId: input.tenantId,
      isAdmin: input.isAdmin,
      globalize: input.globalMitigation,
      delta: {
        tenantId: input.tenantId,
        entityId: input.entityId,
        content,
        summaryBeat,
        bugIndex: PULSE_BUG_INDEX.p2EducationVault,
        source: "globalize",
        globalize: input.globalMitigation,
        metadata: {
          beat_kind: "p2_education_vault",
          incident_id: input.incidentId,
          source_bug_index: input.bugIndex,
        },
      },
      vaultPersist: () =>
        persistToVault({
          supabase: input.adminSupabase,
          entityId: input.entityId,
          tenantId: input.tenantId,
          content,
          bugIndex: PULSE_BUG_INDEX.p2EducationVault,
          summaryBeat,
          legalVersion: CURRENT_LEGAL_VERSION,
          halScore: 100,
          actionType: "P2_EDUCATION_VAULT",
          narrativeExtra: {
            beat_kind: "p2_education_vault",
            p2_cross_ref_priority: true,
            p2_roadmap_education: true,
            human_reasoning: humanReasoning,
            final_fix_applied: finalFixApplied,
            incident_id: input.incidentId,
            source_bug_index: input.bugIndex,
            ...(input.mitigationAction ? { mitigation_action: input.mitigationAction } : {}),
            ...(input.globalMitigation ? { global_mitigation: true } : {}),
          },
        }),
    });

    return {
      narrativeLogId: gate.vaultNarrativeLogId,
      promotion_status: gate.promotion_status,
      local_cache_id: gate.local_cache_id,
    };
  }

  async assertPledgeAndBaseline(
    supabase: SupabaseClient,
    tenantId: string,
    entityId: string,
    hotSession?: PulseHotSession
  ): Promise<
    | { ok: true; legalVersion: string }
    | { ok: false; body: Record<string, unknown> }
  > {
    const cachedPledge = hotSession ? await hotSession.getCachedPledge() : null;
    if (cachedPledge?.kind === "ok") {
      return { ok: true, legalVersion: cachedPledge.legalVersion };
    }
    if (cachedPledge?.kind === "baseline_required") {
      return { ok: false, body: cachedPledge.body };
    }

    /** Narrow PostgREST generic depth from `state_beats` filtering (TS2589). */
    type EqQuery = { eq: (column: string, value: string) => EqQuery };

    let pledgeQuery: EqQuery = supabase
      .from("state_beats")
      .select("id, legal_version")
      .eq("legal_version", CURRENT_LEGAL_VERSION)
      .order("created_at", { ascending: false })
      .limit(1) as unknown as EqQuery;

    pledgeQuery = applyStateBeatsEntityFilter(pledgeQuery, entityId);
    pledgeQuery = applyStateBeatsTenantFilter(pledgeQuery, tenantId);

    const { data: signedBeat, error: signedBeatError } = await (
      pledgeQuery as unknown as {
        maybeSingle: () => Promise<{
          data: { id: string; legal_version: string } | null;
          error: { message: string } | null;
        }>;
      }
    ).maybeSingle();

    if (signedBeatError) {
      throw new PulseHttpError(500, { error: "Unable to verify pledge status." });
    }

    const signedVersion = signedBeat?.legal_version as string | null;
    if (signedVersion !== CURRENT_LEGAL_VERSION) {
      throw new PulseHttpError(403, {
        error: "Please sign the No-AI-Training Pledge to continue.",
      });
    }

    let biometricProfile = await getBiometricProfile(supabase, entityId);
    if (!biometricProfile) {
      biometricProfile = await recalibrateUser(supabase, entityId);
      const baselineBody = {
        ok: false,
        baseline_required: true,
        message: "Baseline Pulse required.",
        prompt: "Type 2-3 sentences about your favorite book",
        baseline_training_remaining: biometricProfile.baseline_training_remaining,
      };
      if (hotSession) {
        await hotSession.setCachedPledge({
          kind: "baseline_required",
          body: baselineBody,
        });
      }
      return { ok: false, body: baselineBody };
    }

    if (hotSession) {
      await hotSession.setCachedPledge({
        kind: "ok",
        legalVersion: signedVersion,
      });
    }

    return { ok: true, legalVersion: signedVersion };
  }

  private gate(rawBody: unknown): {
    keystrokes: KeystrokeEvent[];
    pulseText: string;
    humanTieBreakerResolved: boolean;
    approvedDelta: string | undefined;
  } {
    if (rawBody == null || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      throw new PulseHttpError(400, { error: "JSON body required." });
    }

    const record = rawBody as Record<string, unknown>;
    for (const k of P1_FORBIDDEN_AUTHOR_SPECIFIC_KEYS) {
      if (k in record && record[k] !== undefined) {
        throw new PulseHttpError(400, {
          error: `P1 universal envelope polluted by forbidden key: ${k}`,
        });
      }
    }

    const parsed = PulseBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => i.message).join("; ");
      throw new PulseHttpError(400, {
        error: "Invalid P1 HAL pulse payload.",
        details: detail,
      });
    }

    const universal: UniversalP1PulseBody = {
      keystrokes: parsed.data.keystrokes,
      ...(parsed.data.humanTieBreakerResolved === true
        ? { humanTieBreakerResolved: true }
        : {}),
    };
    assertP1UniversalNonPolluted(universal as unknown as Record<string, unknown>);

    const keystrokes = this.sanitizeKeystrokes(parsed.data.keystrokes);
    const pulseText = keystrokesToPlainText(keystrokes);
    if (!pulseText.trim() && keystrokes.length > 0) {
      throw new PulseHttpError(400, { error: "No usable keystroke data after sanitization." });
    }

    return {
      keystrokes,
      pulseText,
      humanTieBreakerResolved: parsed.data.humanTieBreakerResolved === true,
      approvedDelta: parsed.data.approvedDelta?.trim() || undefined,
    };
  }

  private async crossRef(params: {
    supabase: SupabaseClient;
    adminSupabase?: SupabaseClient;
    tenantId: string;
    entityId: string;
    pulseText: string;
    keystrokes: KeystrokeEvent[];
    documentId?: string;
    activeFilePath?: string;
    applyContextBudget?: boolean;
  }): Promise<{
    previousBeats: StateBeatRow[];
    previousRetryCount: number;
    beatsContext: string;
    hotLayerHit: boolean;
    vaultLineage: LineageLedgerRow[];
    lineageRedisHit: boolean;
    p2Roadmap: P2RoadmapConfig;
    vaultP2Prioritized: PrioritizedVaultLineage;
    p2FlowDirective: string;
    vaultCrossRefContext: string;
    defendConstraints: string;
    globalMitigations: GlobalMitigationsPayload;
  }> {
    const { supabase, tenantId, entityId, pulseText } = params;
    const rulesClient = params.adminSupabase ?? supabase;

    const p2Roadmap = await loadP2Roadmap(rulesClient, tenantId);
    let companyId: string | null = null;
    try {
      companyId = (await fetchProfileCompanyAndRole(rulesClient, entityId)).company_id;
    } catch {
      companyId = null;
    }
    const globalMitigations = await loadLayeredGlobalMitigationsPayload(
      rulesClient,
      tenantId,
      companyId
    );
    const defendConstraints = formatDefendHighPriorityConstraints(globalMitigations);
    const p2FlowDirective =
      buildP2RoadmapDirective(p2Roadmap) + formatGlobalMitigationsDirective(globalMitigations);

    const lineageDocumentId =
      params.activeFilePath?.trim() ||
      params.documentId?.trim() ||
      undefined;

    const lineage = await resolvePrioritizedVaultLineageForP2({
      supabase,
      tenantId,
      pulseText,
      documentId: lineageDocumentId,
      p2Roadmap,
      rulesSupabase: rulesClient,
    });

    const lineageRedisHit = lineage.cacheHit;
    const vaultP2Prioritized = lineage.prioritized;
    const vaultLineage = vaultP2Prioritized.prioritized;
    let vaultCrossRefContext = buildVaultCrossRefContext(vaultP2Prioritized, {
      activeFilePath: params.activeFilePath,
    });
    let beatsContext = "";
    let p2Flow = p2FlowDirective;
    let defend = defendConstraints;

    const activeSlice = await getActiveSlice(entityId);
    if (activeSlice) {
      beatsContext = activeSlice.beatsContext;
      if (params.applyContextBudget) {
        const budgeted = applyConvergeShardableContextBudget({
          vaultCrossRefContext,
          beatsContext,
          p2FlowDirective: p2Flow,
          defendConstraints: defend,
        });
        vaultCrossRefContext = budgeted.vaultCrossRefContext;
        beatsContext = budgeted.beatsContext;
        p2Flow = budgeted.p2FlowDirective;
        defend = budgeted.defendConstraints;
      }
      return {
        previousBeats: activeSlice.previousBeats,
        previousRetryCount: activeSlice.previousRetryCount,
        beatsContext,
        hotLayerHit: true,
        vaultLineage,
        lineageRedisHit,
        p2Roadmap,
        vaultP2Prioritized,
        p2FlowDirective: p2Flow,
        vaultCrossRefContext,
        defendConstraints: defend,
        globalMitigations,
      };
    }

    const p4 = new StateLedgerP4(supabase, tenantId);
    const previousBeats = await p4.fetchPreviousBeats(entityId, 32);
    const latestBeat = previousBeats[previousBeats.length - 1];
    const previousRetryCount =
      typeof latestBeat?.metadata?.retry_count === "number"
        ? (latestBeat.metadata.retry_count as number)
        : 0;
    beatsContext = previousBeats.length
      ? previousBeats.map((b) => `[${b.sequence_index}] ${b.beat_text}`).join("\n")
      : "(no prior beats)";

    if (params.applyContextBudget) {
      const budgeted = applyConvergeShardableContextBudget({
        vaultCrossRefContext,
        beatsContext,
        p2FlowDirective: p2Flow,
        defendConstraints: defend,
      });
      vaultCrossRefContext = budgeted.vaultCrossRefContext;
      beatsContext = budgeted.beatsContext;
      p2Flow = budgeted.p2FlowDirective;
      defend = budgeted.defendConstraints;
    }

    await setActiveSlice({
      entityId,
      previousBeats,
      previousRetryCount,
    });

    return {
      previousBeats,
      previousRetryCount,
      beatsContext,
      hotLayerHit: false,
      vaultLineage,
      lineageRedisHit,
      p2Roadmap,
      vaultP2Prioritized,
      p2FlowDirective: p2Flow,
      vaultCrossRefContext,
      defendConstraints: defend,
      globalMitigations,
    };
  }

  private async defend(params: {
    supabase: SupabaseClient;
    adminSupabase: SupabaseClient;
    tenantId: string;
    entityId: string;
    keystrokes: KeystrokeEvent[];
    pulseText: string;
    forceLomMismatch: boolean;
    lomHarnessEnabled: boolean;
    crossRefVaultLineage: LineageLedgerRow[];
    globalMitigations: GlobalMitigationsPayload;
    defendConstraints: string;
  }): Promise<ShadowPreflightResult> {
    const rulesClient = params.adminSupabase ?? params.supabase;
    let globalMitigations = params.globalMitigations;
    if (!globalMitigations) {
      let companyId: string | null = null;
      try {
        companyId = (await fetchProfileCompanyAndRole(rulesClient, params.entityId)).company_id;
      } catch {
        companyId = null;
      }
      globalMitigations = await loadLayeredGlobalMitigationsPayload(
        rulesClient,
        params.tenantId,
        companyId
      );
    }
    const defendConstraints =
      params.defendConstraints || formatDefendHighPriorityConstraints(globalMitigations);

    let preflight = await preFlightCheck(
      params.supabase,
      {
        text: params.pulseText,
        keystrokes: params.keystrokes,
        contextTag: "pulse_defend_gate",
      },
      { tenantId: params.tenantId }
    );

    preflight = applyDefendMitigationOverrides(
      preflight,
      globalMitigations,
      params.tenantId
    );

    if (params.forceLomMismatch && params.lomHarnessEnabled) {
      preflight = this.buildSyntheticRedPreflight(params.pulseText);
    }

    if (preflight.tier === "RED" && preflight.blocked) {
      if (params.forceLomMismatch && params.lomHarnessEnabled) {
        await this.runLomRecursionGuard({
          adminSupabase: params.adminSupabase,
          entityId: params.entityId,
          tenantId: params.tenantId,
          pulseText: params.pulseText,
          preflight,
        });
      }

      const hallContent =
        typeof preflight.hallMatch?.content === "string" && preflight.hallMatch.content
          ? preflight.hallMatch.content
          : params.pulseText.slice(0, 400) || "shadow_reject";

      // Phase 3/9: RED always opens HITL — never block-and-forget.
      await this.persistHitlToHall({
        adminSupabase: params.adminSupabase,
        entityId: params.entityId,
        tenantId: params.tenantId,
        content: hallContent,
        reason: preflight.reason,
        bugIndex: PULSE_BUG_INDEX.hallHitlRequired,
        tier: "RED",
        actionType: "PULSE_HALL_SHADOW",
        metadataExtra: incidentAttributionMetadataFromHits(
          [...(preflight.scoredHits ?? []), ...(preflight.prunedHits ?? [])],
          preflight.reason
        ),
        narrativeExtra: {
          defend_tier: "RED",
          defend_blocked: true,
          shadow_reject: true,
        },
      });

      // P7: non-blocking source audit (RED block)
      const redHits: SourceHit[] = [
        ...(preflight.scoredHits ?? []),
        ...(preflight.prunedHits ?? []),
      ];
      recordSourceAudit(params.adminSupabase, {
        tenant_id: params.tenantId,
        entity_id: params.entityId,
        trace_id: randomUUID(),
        decision_kind: "defend",
        routing: "defend_red",
        defend_tier: preflight.tier,
        defend_reason: preflight.reason,
        sources: redHits,
        outcome: "block",
      });
      applyReputationOutcome(params.adminSupabase, params.tenantId, redHits, {
        kind: "bad",
        highDrift: true,
        driftScore: 1,
      });

      const hallLabel =
        typeof preflight.hallMatch?.metadata?.label === "string"
          ? preflight.hallMatch.metadata.label
          : "hall.unknown";

      throw new PulseHttpError(403, {
        error: "Forbidden by DEFEND LOM Gate.",
        reason: preflight.reason,
        lineage: {
          label: hallLabel,
          instance: LINEAGE_INSTANCE,
          bug_index: PULSE_BUG_INDEX.hallHitlRequired,
        },
        vault_lineage_count: params.crossRefVaultLineage.length,
        ledger: "hall",
        hitl_required: true,
      });
    }

    return preflight;
  }

  /**
   * LOM Momentum Check â€” instruct models to simplify (never expand) as retries accrue.
   */
  private buildMomentumDirective(momentumRetryCount: number, momentumIncreased = false): string {
    if (momentumRetryCount <= 0 && !momentumIncreased) return "";

    const lines = [
      "",
      "MOMENTUM CHECK (LOM):",
      "- You MUST simplify your logic; do NOT expand scope, add branches, or introduce new hypotheses.",
      "- Prefer the smallest viable explanation and the fewest moving parts.",
    ];

    if (momentumIncreased) {
      lines.push(
        "- Retry count increased this pulse: collapse prior reasoning into a shorter, more conservative judgment."
      );
    }

    if (momentumRetryCount >= PULSE_HALT_STATE_RETRY) {
      lines.push(
        "- Halt-state threshold reached: reason only about what is strictly evidenced in the keystroke chunk."
      );
    }

    return lines.join("\n");
  }

  private wrapPersistableWithHalt(
    delta: string,
    haltStateSummary: string,
    retryCount: number
  ): string {
    return [
      `=== HALT-STATE SUMMARY (retry ${retryCount}) ===`,
      haltStateSummary.trim(),
      "",
      "=== SIMPLIFIED DELTA ===",
      delta.trim(),
    ].join("\n");
  }

  private async generateHaltStateSummary(params: {
    pulseText: string;
    consensus: ChunkConsensus[];
    halScore: number;
    retryCount: number;
    geminiModelId: string;
    beatsContext: string;
    preflight: ShadowPreflightResult;
    geminiVerdict: ModelVerdict;
    claudeVerdict: ModelVerdict;
    modelsDisagree: boolean;
    allHumanConfirmed: boolean;
    p2FlowDirective?: string;
    vaultCrossRefContext?: string;
    defendConstraints?: string;
  }): Promise<string> {
    const model = getVertexGenerativeModelForId(params.geminiModelId);
    const consensusLines = params.consensus
      .map(
        (c, i) =>
          `chunk${i + 1}: gemini=${c.gemini.verdict} (${c.gemini.reason}); claude=${c.claude.verdict} (${c.claude.reason})`
      )
      .join("\n");

    const prompt = `The automated MSGF Pulse pipeline has reached retry_count=${params.retryCount} and must HALT for a Human Tie-Breaker.
${params.defendConstraints ?? ""}
${params.p2FlowDirective ?? ""}
${params.vaultCrossRefContext ?? ""}

Generate a "Halt-State Summary" so the human can finish the move forward immediately.

Rules:
- If Vault lineage contradicts the P2 Roadmap, state that the Roadmap (MSGF 1.0) wins and the human should not revert to deprecated architecture.
- Plain text, no JSON, no markdown fences.
- Do NOT quote user text or include names/IDs.
- Be specific and actionable; do NOT expand scope or propose new features.

Required sections (use these exact headings):

INTENT:
What the engine was trying to accomplish in this pulse (one short paragraph).

STUCK_ON:
The exact disagreement or failure (HAL, model split, consensus, defend tier).

SIMPLIFIED_PATH:
The single simplest next step the human should approve or reject (one or two sentences).

DO_NOT:
What automation must not do next (no expansion, no extra branches).

CONTEXT:
HAL score: ${params.halScore}
retry_count: ${params.retryCount}
gemini_verdict: ${params.geminiVerdict}
claude_verdict: ${params.claudeVerdict}
models_disagree: ${params.modelsDisagree}
all_human_confirmed: ${params.allHumanConfirmed}
defend_preflight_tier: ${params.preflight.tier}
defend_reason: ${params.preflight.reason}
Consensus:
${consensusLines}

Prior beats (abridged):
${params.beatsContext.slice(0, 1200)}

Source text (for intent inference only, do not quote):
${params.pulseText.slice(0, 1200)}
`;

    const result = await runWithLlmTimeoutSimple(
      `pulse.generate_halt_state.${params.geminiModelId}`,
      () =>
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 520 },
        })
    );

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return text;

    return [
      "INTENT:",
      "Automated pulse could not converge human drafting intent under LOM momentum limits.",
      "",
      "STUCK_ON:",
      `HAL=${params.halScore}; gemini=${params.geminiVerdict}; claude=${params.claudeVerdict}; retry=${params.retryCount}.`,
      "",
      "SIMPLIFIED_PATH:",
      "Human Tie-Breaker: confirm or reject the smallest viable intent for this keystroke session.",
      "",
      "DO_NOT:",
      "Do not re-run expanded dual-model reasoning until the human approves a simplified path.",
    ].join("\n");
  }

  private buildPrompt(
    chunk: KeystrokeChunk,
    beatsContext: string,
    momentumRetryCount: number,
    p2Context?: {
      p2FlowDirective: string;
      vaultCrossRefContext: string;
      defendConstraints?: string;
    }
  ): string {
    return `You are evaluating whether a writing keystroke chunk reflects normal human drafting behavior.
${p2Context?.defendConstraints ?? ""}
${p2Context?.p2FlowDirective ?? ""}
${p2Context?.vaultCrossRefContext ?? ""}

Prior user beat context:
${beatsContext}

Keystroke chunk:
${chunk.traceText}
${this.buildMomentumDirective(momentumRetryCount)}

Reply with strict JSON only:
{"verdict":"HUMAN","reason":"short reason"}

Allowed verdict values: HUMAN, NON_HUMAN, INCONCLUSIVE.`;
  }

  private parseVote(text: string): { verdict: ConsensusVote; reason: string } {
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const jsonCandidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
    try {
      const parsed = JSON.parse(jsonCandidate) as {
        verdict?: string;
        reason?: string;
      };
      const verdict =
        parsed.verdict === "HUMAN" ||
        parsed.verdict === "NON_HUMAN" ||
        parsed.verdict === "INCONCLUSIVE"
          ? parsed.verdict
          : "INCONCLUSIVE";
      return { verdict, reason: parsed.reason || "No reason returned." };
    } catch {
      return { verdict: "INCONCLUSIVE", reason: "Unparseable model response." };
    }
  }

  private async runPublisherModel(
    modelPath: string,
    prompt: string
  ): Promise<{ verdict: ConsensusVote; reason: string }> {
    const text = await generatePublisherText({
      modelPath,
      prompt,
      maxTokens: 200,
      temperature: 0.1,
      timeoutLabel: "pulse.consensus.publisher_vertex",
    });
    return this.parseVote(text);
  }

  private async runConsensusForChunk(
    chunk: KeystrokeChunk,
    beatsContext: string,
    geminiModelId: string,
    momentumRetryCount: number,
    p2Context?: {
      tenantId?: string;
      p2FlowDirective: string;
      vaultCrossRefContext: string;
      defendConstraints?: string;
      byokGeminiKey?: string;
      byokAnthropicKey?: string;
      byokXaiKey?: string;
    }
  ): Promise<ChunkConsensus> {
    const prompt = this.buildPrompt(chunk, beatsContext, momentumRetryCount, p2Context);
    const meter = p2Context?.tenantId?.trim()
      ? {
          tenantId: p2Context.tenantId.trim(),
          purpose: "global_converge" as const,
        }
      : undefined;

    const geminiKey = p2Context?.byokGeminiKey?.trim();
    const anthropicKey = p2Context?.byokAnthropicKey?.trim();
    const xaiKey = p2Context?.byokXaiKey?.trim() || platformXaiApiKey() || undefined;
    const bigCfg = resolveBigBrainConsensusConfig();
    const useTri =
      isTriConsensusEnabled() &&
      bigCfg.mode === "TRI" &&
      Boolean(xaiKey || bigCfg.providers.includes("xai"));

    let gemini: { verdict: ConsensusVote; reason: string };
    let claude: { verdict: ConsensusVote; reason: string };
    let grok: { verdict: ConsensusVote; reason: string } | undefined;

    if (geminiKey && anthropicKey) {
      const tasks: Promise<{ verdict: ConsensusVote; reason: string } | undefined>[] = [
        runTenantGeminiValidation(geminiKey, prompt, meter).then((text) => this.parseVote(text)),
        runTenantAnthropicValidation(anthropicKey, prompt, meter).then((text) => this.parseVote(text)),
      ];
      if (useTri && xaiKey) {
        tasks.push(
          runTenantXaiValidation(xaiKey, prompt, meter)
            .then((text) => this.parseVote(text))
            .catch((e) => {
              console.warn("[PulseEngine] xAI/Grok vote skipped:", e instanceof Error ? e.message : e);
              return undefined;
            })
        );
      }
      const results = await Promise.all(tasks);
      gemini = results[0]!;
      claude = results[1]!;
      grok = results[2];
    } else if (
      (geminiKey && xaiKey && !anthropicKey) ||
      (anthropicKey && xaiKey && !geminiKey)
    ) {
      // Tenant bias-mitigated / gemini+grok dual — do not fall through to platform Vertex.
      const aKey = geminiKey || anthropicKey!;
      const aProvider = geminiKey ? "google" : "anthropic";
      const [first, second] = await Promise.all([
        aProvider === "google"
          ? runTenantGeminiValidation(aKey, prompt, meter).then((text) => this.parseVote(text))
          : runTenantAnthropicValidation(aKey, prompt, meter).then((text) => this.parseVote(text)),
        runTenantXaiValidation(xaiKey!, prompt, meter)
          .then((text) => this.parseVote(text))
          .catch((e) => {
            console.warn("[PulseEngine] xAI dual vote failed:", e instanceof Error ? e.message : e);
            return { verdict: "INCONCLUSIVE" as ConsensusVote, reason: "xai_unavailable" };
          }),
      ]);
      if (aProvider === "google") {
        gemini = first;
        claude = { verdict: "INCONCLUSIVE", reason: "anthropic_not_in_preset" };
        grok = second;
      } else {
        gemini = { verdict: "INCONCLUSIVE", reason: "google_not_in_preset" };
        claude = first;
        grok = second;
      }
    } else {
      const projectId = getGcpProjectId();
      const geminiPath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${geminiModelId}`;
      const claudePath = `projects/${projectId}/locations/${CLAUDE_VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MODEL_ID}`;
      const platformVotes = await Promise.all([
        this.runPublisherModel(geminiPath, prompt),
        this.runPublisherModel(claudePath, prompt),
        useTri && xaiKey
          ? runTenantXaiValidation(xaiKey, prompt, meter)
              .then((text) => this.parseVote(text))
              .catch((e) => {
                console.warn("[PulseEngine] platform xAI vote skipped:", e instanceof Error ? e.message : e);
                return undefined;
              })
          : Promise.resolve(undefined as { verdict: ConsensusVote; reason: string } | undefined),
      ]);
      gemini = platformVotes[0]!;
      claude = platformVotes[1]!;
      grok = platformVotes[2];
    }

    const votes: ConsensusVote[] = [];
    if (gemini.reason !== "google_not_in_preset") votes.push(gemini.verdict);
    if (claude.reason !== "anthropic_not_in_preset") votes.push(claude.verdict);
    if (grok) votes.push(grok.verdict);
    if (votes.length < 2) {
      // Degenerate — treat as inconclusive HITL
      votes.push(gemini.verdict, claude.verdict);
    }

    const strictness =
      useTri && grok && votes.length >= 3
        ? bigCfg.strictness
        : votes.length >= 3
          ? "MAJORITY"
          : "UNANIMOUS";
    const decided = decideConsensusVote(votes, strictness);
    const bothHumanLegacy = gemini.verdict === claude.verdict && gemini.verdict === "HUMAN";

    const decision = decided.ok
      ? decided.decision === "HUMAN_CONFIRMED"
        ? "HUMAN_CONFIRMED"
        : decided.decision
      : "HITL_TIEBREAKER_REQUIRED";

    const agreement =
      decided.ok && decided.decision === "HUMAN_CONFIRMED"
        ? true
        : useTri && grok
          ? !decided.tally.no_majority
          : bothHumanLegacy;

    const providersUsed: string[] = [];
    if (gemini.reason !== "google_not_in_preset") providersUsed.push("google");
    if (claude.reason !== "anthropic_not_in_preset") providersUsed.push("anthropic");
    if (grok) providersUsed.push("xai");

    return {
      gemini,
      claude,
      grok,
      agreement,
      decision: decision as ChunkConsensus["decision"],
      halScore: decision === "HUMAN_CONFIRMED" ? 100 : 0,
      vote_tally: decided.tally,
      consensus_mode: providersUsed.length >= 3 ? "TRI" : "DUAL",
      consensus_providers: providersUsed,
    };
  }

  private async buildDeltaAbstraction(params: {
    pulseText: string;
    consensus: ChunkConsensus[];
    halScore: number;
    geminiModelId: string;
    momentumRetryCount?: number;
    momentumIncreased?: boolean;
    p2FlowDirective?: string;
    vaultCrossRefContext?: string;
    defendConstraints?: string;
  }): Promise<string> {
    const {
      pulseText,
      consensus,
      halScore,
      geminiModelId,
      momentumRetryCount = 0,
      momentumIncreased = false,
      p2FlowDirective = "",
      vaultCrossRefContext = "",
      defendConstraints = "",
    } = params;
    const model = getVertexGenerativeModelForId(geminiModelId);
    const momentumBlock = this.buildMomentumDirective(momentumRetryCount, momentumIncreased);
    const prompt = `Summarize the following writing change into a privacy-safe engineering delta.
${defendConstraints}
${p2FlowDirective}
${vaultCrossRefContext}

Requirements:
- Do not include names, IDs, or quoted user text.
- Output <= 3 bullets in plain text.
- Focus on logic intent and structural change only.
- If Vault history conflicts with the P2 Roadmap above, follow the Roadmap (MSGF 1.0 modular gates).
${momentumBlock ? `- MOMENTUM: simplify only; output the minimal delta (no expansion).${momentumBlock}` : ""}

HAL score: ${halScore}
Consensus snapshot: ${consensus
      .map((c, i) => `chunk${i + 1}: gemini=${c.gemini.verdict}, claude=${c.claude.verdict}`)
      .join("; ")}

Source text (for abstraction only):
${pulseText.slice(0, 1800)}
`;

    const maxTokens = momentumRetryCount >= PULSE_HALT_STATE_RETRY ? 160 : 220;
    const result = await runWithLlmTimeoutSimple(
      `pulse.delta_abstraction.${geminiModelId}`,
      () =>
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
        })
    );

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return momentumRetryCount > 0
        ? `Simplified delta (momentum retry ${momentumRetryCount}): minimal intent adjustment; HAL=${halScore}.`
        : `Privacy-safe delta abstraction: intent captured with HAL=${halScore} and consensus-derived structural update.`;
    }
    return text;
  }

  private sanitizeKeystrokes(events: z.infer<typeof KeystrokeEventSchema>[]): KeystrokeEvent[] {
    return events.map((k) => {
      const safeTarget =
        k.target && /name|student/i.test(k.target) ? "redacted" : k.target;
      const safeKey =
        typeof k.key === "string" && k.key.length > 64 ? k.key.slice(0, 61) + "..." : k.key;
      return {
        ts: k.ts,
        key: safeKey,
        type: k.type,
        target: safeTarget,
        ...(typeof k.dwellMs === "number" ? { dwellMs: k.dwellMs } : {}),
        ...(typeof k.flightMs === "number" ? { flightMs: k.flightMs } : {}),
        ...(k.isBackspace === true ? { isBackspace: true } : {}),
        ...(k.isSystemEvent === true ? { isSystemEvent: true } : {}),
        ...(typeof k.wordsPasted === "number" ? { wordsPasted: k.wordsPasted } : {}),
      };
    });
  }

  private buildSyntheticRedPreflight(pulseText: string): ShadowPreflightResult {
    return {
      tier: "RED",
      blocked: true,
      reason: "TEST: forced RED-tier shadow mismatch for LOM harness.",
      vaultMatch: null,
      hallMatch: {
        id: randomUUID(),
        content: pulseText.slice(0, 400) || "synthetic",
        metadata: {
          label: "hall.test_forced",
          ledger: "hall",
          pillar: LINEAGE_CATEGORY,
          instance: LINEAGE_INSTANCE,
        },
      },
      scoredHits: [],
      prunedHits: [],
      contextHits: [],
    };
  }

  private async runLomRecursionGuard(params: {
    adminSupabase: SupabaseClient;
    entityId: string;
    tenantId: string;
    pulseText: string;
    preflight: ShadowPreflightResult;
  }): Promise<never> {
    const attempts = LOM_MAX_ATTEMPTS;

    const p6 = pillarGateMeta("P6");
    const hallContent = params.pulseText.slice(0, 400) || "lom_recursion_reject";

    await persistToHall({
      supabase: params.adminSupabase,
      entityId: params.entityId,
      tenantId: params.tenantId,
      content: hallContent,
      bugIndex: PULSE_BUG_INDEX.hallLomRecursion,
      reason: params.preflight.reason,
      tier: "RED",
      lomAttempts: attempts,
      testForceMismatch: true,
      actionType: "PULSE_HALL_LOM",
      severity: "Violation",
    });

    const { error: ledgerErr } = await params.adminSupabase.from("p4_state_ledger").insert({
      author_id: params.entityId,
      gate: "LOM_SHADOW_RED",
      consensus_status: "rejected",
      state_blob: {
        lineage_label: p6.lineageLabel,
        pillar: p6.pillar,
        lom_attempts: attempts,
        preflight_reason: params.preflight.reason,
        violation_code: p6.violationCode,
        test_force_mismatch: true,
        bug_index: PULSE_BUG_INDEX.hallLomRecursion,
      },
    });

    if (ledgerErr) {
      throw new PulseHttpError(500, {
        error: "Ledger write failed.",
        details: ledgerErr.message,
      });
    }

    throw new PulseHttpError(403, {
      err: ERR_RECURSION_LIMIT,
      error: "DEFEND LOM recursion guard: triple disagreement on shadow RED.",
      lom_attempts: attempts,
      lineage: {
        label: p6.lineageLabel,
        instance: LINEAGE_INSTANCE,
        bug_index: PULSE_BUG_INDEX.hallLomRecursion,
      },
      ledger: "hall",
    });
  }
}

function aggregateVerdict(votes: ConsensusVote[]): ModelVerdict {
  if (votes.some((v) => v === "NON_HUMAN")) return "NON_HUMAN";
  if (votes.some((v) => v === "INCONCLUSIVE")) return "INCONCLUSIVE";
  return "HUMAN";
}

export function keystrokesToPlainText(events: KeystrokeEvent[]): string {
  return events
    .map((e) => {
      if (e.key === "Enter") return "\n";
      if (e.key === "Tab") return "\t";
      if (e.key === "Space" || e.key === " ") return " ";
      if (e.key.length === 1) return e.key;
      return "";
    })
    .join("");
}

export function lomTestHarnessEnabled(): boolean {
  const v = process.env.MSGF_ENABLE_LOM_TEST;
  return v === "1" || v?.toLowerCase() === "true";
}

/** Shared instance for API routes (pulse, admin incidents). */
export const pulseEngine = new PulseEngine();

export {
  PULSE_BUG_INDEX,
  GenealogicalBugIndexSchema,
  VaultHallMetadataSchema,
  NarrativeLogPulseMetadataSchema,
} from "@/lib/schemas/vault-hall-metadata";
