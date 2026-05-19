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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
/**
 * MSGF V3.2-ULTRA Pulse pipeline — SHARD → DEFEND → CONVERGE → PERSIST.
 * Modular: no imports from apps/author-ecosystem.
 */

import { randomUUID } from "crypto";

import { v1beta1 } from "@google-cloud/aiplatform";
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
  SERVICE_ACCOUNT_PATH,
} from "@/lib/msgf-vertex";
import {
  getActiveSlice,
  setActiveSlice,
  HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
} from "@/lib/msgf-hot-layer";
import { msgfRedisKey } from "@/lib/redis";
import { preFlightCheck, type ShadowPreflightResult } from "@/lib/msgf-shadow";
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
  buildP2RoadmapDirective,
  buildVaultCrossRefContext,
  loadP2Roadmap,
  type P2RoadmapConfig,
  type PrioritizedVaultLineage,
} from "@/lib/services/p2-flow-roadmap";
import { resolvePrioritizedVaultLineageForP2 } from "@/lib/services/vault-lineage-p2-cache";
import type { PulseLicenseContext } from "@/lib/services/pulse-license";
import { assessLogicDrift, shouldEscalateToGlobalBrain } from "@/lib/services/logic-drift";
import { processLocalGateway } from "@/lib/services/local-state-gateway";
import {
  isDualModelLocalGatewayEnabled,
  runTenantAnthropicValidation,
  runTenantDualModelConsensusGateway,
  runTenantGeminiValidation,
  type DualModelGatewaySnapshot,
} from "@/lib/services/dual-model-consensus-gateway";
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

const LOM_MAX_ATTEMPTS = MAX_RECURSION_DEPTH;
/** HITL / LOM recursion ceiling — exceeding throws {@link ERR_RECURSION_LIMIT}. */
export const PULSE_RECURSION_MAX_RETRY = MAX_RECURSION_DEPTH;

/** At this retry count, CONVERGE emits a Halt-State Summary for the Human Tie-Breaker. */
export const PULSE_HALT_STATE_RETRY = 3;

const LINEAGE_INSTANCE = "1.1.1";
const LINEAGE_CATEGORY = "P6";
const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const CLAUDE_MODEL_ID = process.env.MSGF_CLAUDE_MODEL || "claude-4.6-sonnet";

export const ERR_RECURSION_LIMIT = "ERR_RECURSION_LIMIT" as const;

type ConsensusVote = "HUMAN" | "NON_HUMAN" | "INCONCLUSIVE";

type ChunkConsensus = {
  gemini: { verdict: ConsensusVote; reason: string };
  claude: { verdict: ConsensusVote; reason: string };
  agreement: boolean;
  decision: "HUMAN_CONFIRMED" | "HITL_TIEBREAKER_REQUIRED";
  halScore: number;
};

const KeystrokeEventSchema = z.object({
  ts: z.number().finite(),
  key: z.string().min(1),
  type: z.enum(["keydown", "keyup", "input"]).optional(),
  target: z.string().optional(),
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
  forceLomMismatch: boolean;
  lomHarnessEnabled: boolean;
};

export type PulseFullPipelineInput = PulseEngineInput & {
  geminiModelId: string;
  license: PulseLicenseContext;
  /** Logic-drift sensitivity slider (0.1 strict → 0.5 relaxed). Default 0.3. */
  logicDriftEscalationThreshold?: number;
  /** V3.2 SHARD / CROSS-REF hot session from the HTTP route (Redis fail-open). */
  hotSession?: PulseHotSession;
  /** IDE `.msgf/keys` BYOK for dual-model local gateway. */
  byokGeminiKey?: string | null;
  byokAnthropicKey?: string | null;
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
  /** True when P1–P6 governance baselines exist in `pillar_vectors` for this tenant. */
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
};

export type PulsePersistResult = {
  vaultNarrativeLogId?: string;
  hallNarrativeLogId?: string;
  ledger: "vault" | "hall" | null;
};

export type PulseFullPipelineOk = {
  kind: "ok";
  /** Tenant / IDE safe — no LOM chain-of-thought, chunks, or raw verify rationales. */
  public: Record<string, unknown>;
  /** Full forensic trace — persisted to `admin_vault` (service_role only). */
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
};

export class PulseEngine {
  /**
   * V3.2 full pipeline: SHARD/DEFEND → CONVERGE (dual-model + HAL) → PERSIST (Vault/Hall + beats).
   */
  async runFullPipeline(input: PulseFullPipelineInput): Promise<PulseFullPipelineResult> {
    const pulseTraceId = input.traceId?.trim() || randomUUID();

    const pledge = await this.assertPledgeAndBaseline(
      input.supabase,
      input.tenantId,
      input.entityId,
      input.hotSession
    );
    if (!pledge.ok) {
      return {
        kind: "baseline_required",
        public: { ...pledge.body, trace_id: pulseTraceId },
        forensic: {
          kind: "pulse_baseline_required",
          tenant_id: input.tenantId,
          entity_id: input.entityId,
          trace_id: pulseTraceId,
          captured_at: new Date().toISOString(),
        },
      };
    }

    try {
    let isPillarBaselineSet = await isTenantPillarBaselineSet(
      input.adminSupabase,
      input.tenantId
    );

    if (!isPillarBaselineSet) {
      await ensureTenantPillarBaseline(input.adminSupabase, input.tenantId);
      isPillarBaselineSet = await isTenantPillarBaselineSet(
        input.adminSupabase,
        input.tenantId
      );
    }

    const defended = await this.runThroughDefend(input, isPillarBaselineSet);

    const biometricProfile = await getBiometricProfile(input.supabase, input.entityId);
    const biometric = calculateBiometricScore({
      keystrokes: defended.keystrokes,
      profile: biometricProfile,
    });

    const logicDrift = assessLogicDrift({
      pulseText: defended.pulseText,
      halScore: biometric.score,
      biometricDeltaOver30: biometric.deltaOver30Percent,
      vaultP2Prioritized: defended.vaultP2Prioritized,
      preflight: defended.preflight,
      escalationThreshold: input.logicDriftEscalationThreshold,
    });

    const forceGlobal =
      defended.humanTieBreakerResolved || Boolean(defended.approvedDelta?.trim());

    const { commercial: tenantCommercial, routing: convergeRouting } =
      await resolveConvergeConsensusRouting({
        adminSupabase: input.adminSupabase,
        tenantId: input.tenantId,
        entityId: input.entityId,
        license: input.license,
        headerGeminiKey: input.byokGeminiKey,
        headerAnthropicKey: input.byokAnthropicKey,
      });

    if (!shouldEscalateToGlobalBrain(logicDrift, { forceGlobal })) {
      let dualModelGateway: DualModelGatewaySnapshot | undefined;
      if (
        isDualModelLocalGatewayEnabled() &&
        shouldRunLocalDualModelGateway(convergeRouting)
      ) {
        dualModelGateway = await runTenantDualModelConsensusGateway({
          adminSupabase: input.adminSupabase,
          tenantId: input.tenantId,
          pulseText: defended.pulseText,
          keystrokes: defended.keystrokes,
          beatsContext: defended.beatsContext,
          p2FlowDirective: defended.p2FlowDirective,
          vaultCrossRefContext: defended.vaultCrossRefContext,
          defendConstraints: defended.defendConstraints,
          geminiModelId: input.geminiModelId,
          byokGeminiKey:
            convergeRouting.action === "run_byok_converge"
              ? convergeRouting.byok.gemini
              : convergeRouting.byok.gemini ?? input.byokGeminiKey,
          byokAnthropicKey:
            convergeRouting.action === "run_byok_converge"
              ? convergeRouting.byok.anthropic
              : convergeRouting.byok.anthropic ?? input.byokAnthropicKey,
          skipTenantCredentialAssert:
            convergeRouting.segment === "corporate_paid" ||
            convergeRouting.action === "run_perpetual_platform_converge",
        });
      }

      const local = await processLocalGateway({
        supabase: input.supabase,
        tenantId: input.tenantId,
        entityId: input.entityId,
        legalVersion: pledge.legalVersion,
        pulseText: defended.pulseText,
        keystrokes: defended.keystrokes,
        logicDrift,
        isPillarBaselineSet: defended.isPillarBaselineSet,
        defendPreflightTier: defended.preflight.tier,
        pulseTraceId,
        dualModelGateway,
      });

      await setActiveSlice({
        entityId: input.entityId,
        previousBeats: [...defended.previousBeats, local.storedBeat].slice(-32),
        previousRetryCount: defended.previousRetryCount,
      });

      const remediationSummary = buildPulseRemediationSummaryLocal();
      const glass = buildPulseGlassBoxData({
        driftScore: logicDrift.score,
        preflightTier: String(defended.preflight.tier),
        routing: "local_gateway",
        humanTiebreakerRequired: false,
        halScore: biometric.score,
        ledger: null,
        consensusAllHuman: null,
        modelsDisagree: null,
        remediationSummary,
      });

      const publicBody: Record<string, unknown> = {
        ok: true,
        trace_id: pulseTraceId,
        data: glass,
        routing: "local_gateway",
        logic_drift_score: logicDrift.score,
        logic_drift_escalation_threshold: logicDrift.escalation_threshold,
        contradicts_p2_roadmap: logicDrift.contradictsP2Roadmap,
        is_pillar_baseline_set: defended.isPillarBaselineSet,
        beat: stripPublicBeat(local.storedBeat),
        hal_score: biometric.score,
        retry_count: defended.previousRetryCount,
        tie_breaker_protocol_triggered: false,
        human_tiebreaker_required: false,
        human_tiebreaker_resolved: false,
        block_user: false,
        active_slice_ttl_seconds: HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
        hot_layer_hit: defended.hotLayerHit,
        lineage_redis_hit: defended.lineageRedisHit,
        vault_narrative_log_id: null,
        hall_narrative_log_id: null,
        ledger: null,
        license_tenant: input.license.tenantId,
        license_tier: input.license.tierId,
        defend_preflight_tier: defended.preflight.tier,
        vault_lineage_hits: defended.vaultLineage.length,
        vault_p2_aligned: defended.vaultP2Prioritized.aligned.length,
        vault_p2_contradicts_roadmap: defended.vaultP2Prioritized.contradicts.length,
        p2_roadmap_version: defended.p2Roadmap.version,
        momentum_increased: false,
        tenant_commercial_segment: tenantCommercial.segment,
        converge_routing_action: convergeRouting.action,
        ...(dualModelGateway
          ? {
              dual_model_tenant_agreement_score: dualModelGateway.tenant_agreement_score,
              dual_model_sovereign_escalated: dualModelGateway.sovereign_escalated,
              dual_model_sovereign_agreement_score: dualModelGateway.sovereign_agreement_score,
            }
          : {}),
        ...buildConvergePublicResponseFields(convergeRouting),
      };

      const forensic: Record<string, unknown> = {
        kind: "pulse_local_gateway",
        trace_id: pulseTraceId,
        captured_at: new Date().toISOString(),
        tenant_id: input.tenantId,
        entity_id: input.entityId,
        pulse_text: defended.pulseText,
        keystrokes: defended.keystrokes,
        logic_drift: logicDrift,
        biometric,
        stored_beat_row: local.storedBeat,
        defend_preflight: defended.preflight,
        vault_lineage_snapshot: defended.vaultLineage.slice(0, 25),
        vault_cross_ref_context: defended.vaultCrossRefContext,
        p2_flow_directive: defended.p2FlowDirective,
        defend_constraints: defended.defendConstraints,
        vault_p2_prioritized: defended.vaultP2Prioritized,
        p2_roadmap: defended.p2Roadmap,
        global_mitigations: defended.globalMitigations,
        hot_layer_hit: defended.hotLayerHit,
        lineage_redis_hit: defended.lineageRedisHit,
        dual_model_gateway: dualModelGateway ?? null,
        tenant_commercial_segment: tenantCommercial.segment,
        converge_routing: convergeRouting,
      };

      return {
        kind: "ok",
        public: publicBody,
        forensic,
      };
    }

    if (isConvergeEscalationBypassOrDegraded(convergeRouting)) {
      const beatLabel =
        convergeRouting.action === "soft_cap_exceeded_ide_degraded"
          ? "converge_soft_cap_degraded"
          : "converge_bypass";

      const local = await processLocalGateway({
        supabase: input.supabase,
        tenantId: input.tenantId,
        entityId: input.entityId,
        legalVersion: pledge.legalVersion,
        pulseText: defended.pulseText,
        keystrokes: defended.keystrokes,
        logicDrift,
        isPillarBaselineSet: defended.isPillarBaselineSet,
        defendPreflightTier: defended.preflight.tier,
        pulseTraceId,
        beatLabel,
        convergeBypass: convergeRouting.action !== "soft_cap_exceeded_ide_degraded",
      });

      await setActiveSlice({
        entityId: input.entityId,
        previousBeats: [...defended.previousBeats, local.storedBeat].slice(-32),
        previousRetryCount: defended.previousRetryCount,
      });

      const remediationSummary = buildPulseRemediationSummaryLocal();
      const routingLabel =
        convergeRouting.action === "soft_cap_exceeded_ide_degraded"
          ? "converge_soft_cap_degraded"
          : "converge_bypass";

      const glass = buildPulseGlassBoxData({
        driftScore: logicDrift.score,
        preflightTier: String(defended.preflight.tier),
        routing: routingLabel,
        humanTiebreakerRequired: false,
        halScore: biometric.score,
        ledger: null,
        consensusAllHuman: null,
        modelsDisagree: null,
        remediationSummary,
      });

      const publicBody: Record<string, unknown> = {
        ok: true,
        trace_id: pulseTraceId,
        data: glass,
        routing: routingLabel,
        ...buildConvergePublicResponseFields(convergeRouting),
        logic_drift_score: logicDrift.score,
        logic_drift_escalation_threshold: logicDrift.escalation_threshold,
        contradicts_p2_roadmap: logicDrift.contradictsP2Roadmap,
        is_pillar_baseline_set: defended.isPillarBaselineSet,
        beat: stripPublicBeat(local.storedBeat),
        hal_score: biometric.score,
        retry_count: defended.previousRetryCount,
        tie_breaker_protocol_triggered: false,
        human_tiebreaker_required: false,
        human_tiebreaker_resolved: false,
        block_user: false,
        active_slice_ttl_seconds: HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
        hot_layer_hit: defended.hotLayerHit,
        lineage_redis_hit: defended.lineageRedisHit,
        vault_narrative_log_id: null,
        hall_narrative_log_id: null,
        ledger: null,
        license_tenant: input.license.tenantId,
        license_tier: input.license.tierId,
        tenant_commercial_segment: tenantCommercial.segment,
        defend_preflight_tier: defended.preflight.tier,
        vault_lineage_hits: defended.vaultLineage.length,
        vault_p2_aligned: defended.vaultP2Prioritized.aligned.length,
        vault_p2_contradicts_roadmap: defended.vaultP2Prioritized.contradicts.length,
        p2_roadmap_version: defended.p2Roadmap.version,
        momentum_increased: false,
      };

      const forensic: Record<string, unknown> = {
        kind:
          convergeRouting.action === "soft_cap_exceeded_ide_degraded"
            ? "pulse_converge_soft_cap_degraded"
            : "pulse_converge_bypass",
        trace_id: pulseTraceId,
        captured_at: new Date().toISOString(),
        tenant_id: input.tenantId,
        entity_id: input.entityId,
        pulse_text: defended.pulseText,
        keystrokes: defended.keystrokes,
        logic_drift: logicDrift,
        biometric,
        stored_beat_row: local.storedBeat,
        defend_preflight: defended.preflight,
        tenant_commercial_segment: tenantCommercial.segment,
        converge_routing: convergeRouting,
        byok_presence: {
          gemini: convergeRouting.byok.sources.gemini,
          anthropic: convergeRouting.byok.sources.anthropic,
        },
      };

      return {
        kind: "ok",
        public: publicBody,
        forensic,
      };
    }

    const byokConverge =
      convergeRouting.action === "run_byok_converge"
        ? {
            geminiKey: convergeRouting.byok.gemini!,
            anthropicKey: convergeRouting.byok.anthropic!,
          }
        : undefined;

    const corporateVaultByok =
      convergeRouting.action === "run_corporate_system_converge" &&
      convergeRouting.enterpriseVaultConfigured
        ? {
            geminiKey: convergeRouting.byok.gemini!,
            anthropicKey: convergeRouting.byok.anthropic!,
          }
        : undefined;

    const convergeByok = byokConverge ?? corporateVaultByok;
    const platformMaster = usesPlatformMasterConvergeCredentials(convergeRouting);

    const converged = await this.converge({
      ...defended,
      supabase: input.supabase,
      adminSupabase: input.adminSupabase,
      legalVersion: pledge.legalVersion,
      geminiModelId: input.geminiModelId,
      license: input.license,
      convergeCredentialMode: platformMaster
        ? convergeRouting.segment === "individual_perpetual"
          ? "individual_perpetual_platform"
          : "corporate_system"
        : "individual_byok",
      byokGeminiKey: convergeByok?.geminiKey,
      byokAnthropicKey: convergeByok?.anthropicKey,
    });

    if (convergeRouting.action === "run_perpetual_platform_converge") {
      await recordPerpetualPlatformConvergeSlice({
        adminSupabase: input.adminSupabase,
        entityId: input.entityId,
        tenantId: input.tenantId,
        idempotencyKey: pulseTraceId,
        traceId: pulseTraceId,
      });
    }

    const persisted = await this.persist({
      adminSupabase: input.adminSupabase,
      converged,
      pulseTraceId,
    });

    const remediationSummary = buildPulseRemediationSummaryGlobal({
      ledger: persisted.ledger,
      humanTiebreakerRequired: converged.requiresTieBreaker,
      allHumanConfirmed: converged.allHumanConfirmed,
      modelsDisagree: converged.modelsDisagree,
    });
    const glass = buildPulseGlassBoxData({
      driftScore: logicDrift.score,
      preflightTier: String(converged.preflight.tier),
      routing: "global_brain_converge",
      humanTiebreakerRequired: converged.requiresTieBreaker,
      halScore: converged.halScore,
      ledger: persisted.ledger,
      consensusAllHuman: converged.allHumanConfirmed,
      modelsDisagree: converged.modelsDisagree,
      remediationSummary,
    });

    const publicBody: Record<string, unknown> = {
      ok: true,
      trace_id: pulseTraceId,
      data: glass,
      routing: "global_brain_converge",
      logic_drift_score: logicDrift.score,
      logic_drift_escalation_threshold: logicDrift.escalation_threshold,
      contradicts_p2_roadmap: logicDrift.contradictsP2Roadmap,
      is_pillar_baseline_set: defended.isPillarBaselineSet,
      beat: stripPublicBeat(converged.storedBeat),
      hal_score: converged.halScore,
      retry_count: converged.retryCount,
      tie_breaker_protocol_triggered: converged.tieBreakerProtocolTriggered,
      human_tiebreaker_required: converged.requiresTieBreaker,
      human_tiebreaker_resolved: converged.humanTieBreakerResolved,
      block_user: false,
      active_slice_ttl_seconds: HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
      hot_layer_hit: converged.hotLayerHit,
      lineage_redis_hit: converged.lineageRedisHit,
      vault_narrative_log_id: persisted.vaultNarrativeLogId,
      hall_narrative_log_id: persisted.hallNarrativeLogId,
      ledger: persisted.ledger,
      license_tenant: input.license.tenantId,
      license_tier: input.license.tierId,
      tenant_commercial_segment: tenantCommercial.segment,
      converge_credential_mode: platformMaster
        ? convergeRouting.segment === "individual_perpetual"
          ? "individual_perpetual_platform"
          : "corporate_system"
        : "individual_byok",
      ...buildConvergePublicResponseFields(convergeRouting),
      ...(convergeRouting.segment === "individual_perpetual" &&
      "monthlyUsage" in convergeRouting
        ? {
            monthly_slices_consumed: convergeRouting.monthlyUsage.slicesConsumed,
            monthly_slice_soft_cap: convergeRouting.monthlyUsage.softCap,
          }
        : {}),
      defend_preflight_tier: converged.preflight.tier,
      vault_lineage_hits: converged.vaultLineage.length,
      vault_p2_aligned: converged.vaultP2Prioritized.aligned.length,
      vault_p2_contradicts_roadmap: converged.vaultP2Prioritized.contradicts.length,
      p2_roadmap_version: converged.p2Roadmap.version,
      consensus_all_human: converged.allHumanConfirmed,
      models_disagree: converged.modelsDisagree,
      momentum_increased: converged.momentumIncreased,
    };

    const forensic: Record<string, unknown> = {
      kind: "pulse_global_converge",
      trace_id: pulseTraceId,
      captured_at: new Date().toISOString(),
      tenant_id: input.tenantId,
      entity_id: input.entityId,
      pulse_text: defended.pulseText,
      keystrokes: defended.keystrokes,
      logic_drift: logicDrift,
      chunks: converged.chunks,
      p4_verify_results: converged.verifyResults,
      lom_consensus: converged.consensus.map((c) => ({
        gemini: c.gemini,
        claude: c.claude,
        agreement: c.agreement,
        decision: c.decision,
        halScore: c.halScore,
      })),
      hal_full: converged.hal,
      halt_state_summary: converged.haltStateSummary ?? null,
      persistable_delta: converged.persistableDelta,
      summary_beat: converged.summaryBeat,
      stored_beat_row: converged.storedBeat,
      gemini_verdict: converged.geminiVerdict,
      claude_verdict: converged.claudeVerdict,
      defend_preflight: converged.preflight,
      vault_cross_ref_context: converged.vaultCrossRefContext,
      p2_flow_directive: converged.p2FlowDirective,
      defend_constraints: converged.defendConstraints,
      vault_p2_prioritized: converged.vaultP2Prioritized,
      p2_roadmap: converged.p2Roadmap,
      narrative_ids: {
        vault: persisted.vaultNarrativeLogId,
        hall: persisted.hallNarrativeLogId,
      },
      ledger: persisted.ledger,
    };

    return {
      kind: "ok",
      public: publicBody,
      forensic,
    };
    } catch (e: unknown) {
      if (isCostRunawayError(e)) {
        await recordCostRunawayDeadLetterSafe({
          adminSupabase: input.adminSupabase,
          tenantId: input.tenantId,
          entityId: input.entityId,
          traceId: pulseTraceId,
          operation: "pulse.run_full_pipeline",
          error: e,
        });
        throw new PulseHttpError(503, {
          error: "MSGF cost-runaway guard tripped (timeout or AI recursion cap).",
          code: "COST_RUNAWAY_GUARD",
          trace_id: pulseTraceId,
        });
      }
      throw e;
    }
  }

  async runThroughDefend(
    input: PulseEngineInput,
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
   * CONVERGE — dual-model consensus (Gemini + Claude shadow), HAL scoring, state_beats append.
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
    }
  ): Promise<PulseConvergeContext> {
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

    const consensus = await Promise.all(
      chunkForConsensus.map((c) =>
        this.runConsensusForChunk(c, ctx.beatsContext, ctx.geminiModelId, momentumRetryForPrompt, {
          p2FlowDirective: ctx.p2FlowDirective,
          vaultCrossRefContext: ctx.vaultCrossRefContext,
          defendConstraints: ctx.defendConstraints,
          byokGeminiKey: useByokConverge ? ctx.byokGeminiKey : undefined,
          byokAnthropicKey: useByokConverge ? ctx.byokAnthropicKey : undefined,
        })
      )
    );

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

    const halScore = hal.halScore;
    const recalibrationActive = hal.flags.baselineTrainingActive;
    const modelsDisagree = geminiVerdict !== claudeVerdict;
    const retryCount =
      halScore < 70 && modelsDisagree ? ctx.previousRetryCount + 1 : ctx.previousRetryCount;
    const momentumIncreased = retryCount > ctx.previousRetryCount;
    const effectiveMomentumRetry = Math.max(retryCount, ctx.previousRetryCount);
    const tieBreakerProtocolTriggered = retryCount > PULSE_RECURSION_MAX_RETRY;
    const requiresTieBreaker =
      !allHumanConfirmed ||
      halScore < 70 ||
      (halScore < 70 && recalibrationActive) ||
      tieBreakerProtocolTriggered;

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
    };
  }

  /**
   * PERSIST — Vault (consensus OK) or Hall (consensus fail / LOM disagreement / HITL).
   * Refreshes hot-layer active slice; every narrative log carries 1.1.1 bug_index.
   */
  async persist(params: {
    adminSupabase: SupabaseClient;
    converged: PulseConvergeContext;
    pulseTraceId: string;
  }): Promise<PulsePersistResult> {
    const c = params.converged;
    const consensusFailed = !c.allHumanConfirmed;
    const lomDisagreement = c.modelsDisagree;
    const canPersistVault =
      c.allHumanConfirmed &&
      !lomDisagreement &&
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
    } else {
      const bugIndex = consensusFailed
        ? PULSE_BUG_INDEX.hallConsensusFailed
        : lomDisagreement
          ? PULSE_BUG_INDEX.hallLomDisagreement
          : PULSE_BUG_INDEX.hallHitlRequired;

      const haltNote = c.haltStateSummary
        ? " Halt-State Summary attached for Human Tie-Breaker."
        : "";
      const reason = consensusFailed
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
        actionType: consensusFailed
          ? "PULSE_HALL_CONSENSUS_FAIL"
          : lomDisagreement
            ? "PULSE_HALL_LOM_DISAGREE"
            : "PULSE_HALL_HITL",
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
    }

    const refreshedBeats = [...c.previousBeats, c.storedBeat].slice(-32);
    await setActiveSlice({
      entityId: c.entityId,
      previousBeats: refreshedBeats,
      previousRetryCount: c.retryCount,
    });

    return { vaultNarrativeLogId, hallNarrativeLogId, ledger };
  }

  /**
   * Global Approval Gate — routes LogicDelta to `local_state_cache` or `vault_core` (pillar_vectors).
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
      ? `Arbitration Beat — ${strategyLabel}`
      : "Arbitration Beat — operator resolution";

    const content = [
      "[P2 Cross-Ref — human-corrected arbitration_beat]",
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
      ? "P2 education — global mitigation (all future sessions)"
      : "P2 education — session resolution";

    const content = [
      "[P2 Roadmap education vault — human-corrected]",
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

  private async assertPledgeAndBaseline(
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

    const lineage = await resolvePrioritizedVaultLineageForP2({
      supabase,
      tenantId,
      pulseText,
      documentId: params.documentId,
      p2Roadmap,
      rulesSupabase: rulesClient,
    });

    const lineageRedisHit = lineage.cacheHit;
    const vaultP2Prioritized = lineage.prioritized;
    const vaultLineage = vaultP2Prioritized.prioritized;
    const vaultCrossRefContext = buildVaultCrossRefContext(vaultP2Prioritized);

    const activeSlice = await getActiveSlice(entityId);
    if (activeSlice) {
      return {
        previousBeats: activeSlice.previousBeats,
        previousRetryCount: activeSlice.previousRetryCount,
        beatsContext: activeSlice.beatsContext,
        hotLayerHit: true,
        vaultLineage,
        lineageRedisHit,
        p2Roadmap,
        vaultP2Prioritized,
        p2FlowDirective,
        vaultCrossRefContext,
        defendConstraints,
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
    const beatsContext = previousBeats.length
      ? previousBeats.map((b) => `[${b.sequence_index}] ${b.beat_text}`).join("\n")
      : "(no prior beats)";

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
      p2FlowDirective,
      vaultCrossRefContext,
      defendConstraints,
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

      await persistToHall({
        supabase: params.adminSupabase,
        entityId: params.entityId,
        tenantId: params.tenantId,
        content: hallContent,
        bugIndex: PULSE_BUG_INDEX.hallShadowReject,
        reason: preflight.reason,
        tier: "RED",
        actionType: "PULSE_HALL_SHADOW",
        severity: "Violation",
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
          bug_index: PULSE_BUG_INDEX.hallShadowReject,
        },
        vault_lineage_count: params.crossRefVaultLineage.length,
        ledger: "hall",
      });
    }

    return preflight;
  }

  /**
   * LOM Momentum Check — instruct models to simplify (never expand) as retries accrue.
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
    const client = new v1beta1.PredictionServiceClient({
      keyFilename: SERVICE_ACCOUNT_PATH,
      apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
    });

    const [resp] = await runWithLlmTimeoutSimple("pulse.consensus.publisher_vertex", () =>
      client.generateContent({
        model: modelPath,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      })
    );

    const text = resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return this.parseVote(text);
  }

  private async runConsensusForChunk(
    chunk: KeystrokeChunk,
    beatsContext: string,
    geminiModelId: string,
    momentumRetryCount: number,
    p2Context?: {
      p2FlowDirective: string;
      vaultCrossRefContext: string;
      defendConstraints?: string;
      byokGeminiKey?: string;
      byokAnthropicKey?: string;
    }
  ): Promise<ChunkConsensus> {
    const prompt = this.buildPrompt(chunk, beatsContext, momentumRetryCount, p2Context);

    const geminiKey = p2Context?.byokGeminiKey?.trim();
    const anthropicKey = p2Context?.byokAnthropicKey?.trim();

    const [gemini, claude] =
      geminiKey && anthropicKey
        ? await Promise.all([
            runTenantGeminiValidation(geminiKey, prompt).then((text) => this.parseVote(text)),
            runTenantAnthropicValidation(anthropicKey, prompt).then((text) =>
              this.parseVote(text)
            ),
          ])
        : await (async () => {
            const projectId = getGcpProjectId();
            const geminiPath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${geminiModelId}`;
            const claudePath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MODEL_ID}`;
            return Promise.all([
              this.runPublisherModel(geminiPath, prompt),
              this.runPublisherModel(claudePath, prompt),
            ]);
          })();

    const agreement = gemini.verdict === claude.verdict;
    const bothHuman = agreement && gemini.verdict === "HUMAN";

    return {
      gemini,
      claude,
      agreement,
      decision: bothHuman ? "HUMAN_CONFIRMED" : "HITL_TIEBREAKER_REQUIRED",
      halScore: bothHuman ? 100 : 0,
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
