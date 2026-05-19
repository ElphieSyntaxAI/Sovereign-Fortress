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
 * ARBITRATE remediation — Modular Strategy Matrix (SSOT).
 *
 * Maps genealogical `1.1.1_*` bug indices to operator remediation paths with:
 * - **Global logic** — strategic / P2 Roadmap conflicts (apply across sessions via `msgf_rules`)
 * - **Local logic** — routine formatting, telemetry, single-session hygiene (SHARD / SWEEP-class)
 *
 * Import from server/BFF via `msgf/connector/server` or `msgf/remediation` (not browser bundles).
 */

import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { P2_FLOW_SEQUENCE_STEPS, type P2FlowStep } from "@/lib/services/p2-flow-roadmap";

/** Qualitative band for operator UI badges. */
export type RemediationRisk = "Low" | "Medium" | "High";

/**
 * - `global` — Strategic fixes: P2 Roadmap alignment, Vault vs Hall precedence, global mitigations.
 * - `local` — Session-local fixes: keystroke shards, formatting, telemetry rhythm, minor deltas.
 */
export type RemediationLogicScope = "global" | "local";

/** One row in the modular strategy matrix. */
export type ModularRemediationStrategy = {
  /** Stable id within a bug instance (e.g. `global-converge`, `local-shard`). */
  id: string;
  scope: RemediationLogicScope;
  bug_index_instance: string;
  /** P2 pipeline pillar tie-in (SHARD → … → PERSIST). */
  pillar: P2FlowStep;
  label: string;
  fix: string;
  consequence: string;
  risk: RemediationRisk;
  /** Consequence score (0–100): risk to Brain integrity / Vault stability (higher = worse). */
  consequence_score: number;
  /** When true, suitable for `msgf_rules` global_mitigations / apply-to-all-future-sessions. */
  apply_to_future_sessions: boolean;
  rationale: string;
};

/** @deprecated Use {@link ModularRemediationStrategy}; kept for admin matrix row compat. */
export type RemediationMatrixRow = {
  bug_index_instance: string;
  pillar: P2FlowStep;
  fix: string;
  consequence: string;
  risk: RemediationRisk;
};

/** Strategy returned to callers (matrix row + computed numeric risk). */
export type RemediationStrategy = RemediationMatrixRow & {
  consequence_score: number;
  scope?: RemediationLogicScope;
  strategy_id?: string;
  apply_to_future_sessions?: boolean;
  rationale?: string;
};

/** Admin API / Decision Portal DTO. */
export type AdminIncidentStrategyDto = {
  pillar: string;
  label: string;
  fixTemplate: string;
  consequence: string;
  riskScore: number;
  scope: RemediationLogicScope;
  applyToFutureSessions: boolean;
};

export function buildRemediationFixTemplate(
  pillar: P2FlowStep,
  fix: string,
  consequence?: string
): string {
  const tail = consequence?.trim() ? `. ${consequence.trim()}` : "";
  return `[OVERRIDE: ${pillar}] - ${fix.trim()}${tail}`;
}

export function toAdminIncidentStrategyDto(
  strategy: ModularRemediationStrategy | RemediationStrategy
): AdminIncidentStrategyDto {
  const scope =
    "scope" in strategy && strategy.scope ? strategy.scope : ("global" as RemediationLogicScope);
  const apply =
    "apply_to_future_sessions" in strategy
      ? Boolean(strategy.apply_to_future_sessions)
      : scope === "global";

  return {
    pillar: strategy.pillar,
    label: "label" in strategy && strategy.label ? strategy.label : strategy.fix,
    fixTemplate: buildRemediationFixTemplate(strategy.pillar, strategy.fix, strategy.consequence),
    consequence: strategy.consequence,
    riskScore: strategy.consequence_score,
    scope,
    applyToFutureSessions: apply,
  };
}

const HITL = PULSE_BUG_INDEX.hallHitlRequired.level_1_1_1_instance;
const LOM_REC = PULSE_BUG_INDEX.hallLomRecursion.level_1_1_1_instance;
const SHADOW = PULSE_BUG_INDEX.hallShadowReject.level_1_1_1_instance;
const CONSENSUS_FAIL = PULSE_BUG_INDEX.hallConsensusFailed.level_1_1_1_instance;
const LOM_DISAGREE = PULSE_BUG_INDEX.hallLomDisagreement.level_1_1_1_instance;
const VAULT_OK = PULSE_BUG_INDEX.vaultConsensusOk.level_1_1_1_instance;
const USER_SENTINEL = PULSE_BUG_INDEX.userSentinelReport.level_1_1_1_instance;

/**
 * Modular Strategy Matrix — multiple remediation paths per `1.1.1` instance.
 * Global strategies are listed before local strategies for each instance.
 */
export const MODULAR_STRATEGY_MATRIX: Record<string, readonly ModularRemediationStrategy[]> = {
  [USER_SENTINEL]: [
    {
      id: "global-p2-roadmap-realign",
      scope: "global",
      bug_index_instance: USER_SENTINEL,
      pillar: "CROSS-REF",
      label: "Realign with P2 Roadmap",
      fix: "Apply P2 Roadmap education beat to Vault lineage",
      consequence: "Global governance update for similar sessions",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale:
        "Global: Sentinel report indicates strategic P2 conflict — persist roadmap-aligned mitigation.",
    },
    {
      id: "local-sentinel-unblock",
      scope: "local",
      bug_index_instance: USER_SENTINEL,
      pillar: "SWEEP",
      label: "Local session unblock delta",
      fix: "Apply Local Delta to session state_beats",
      consequence: "Cosmetic / session-local only; unblocks author without global CONVERGE",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale:
        "Local: Emergency LOM detected P2 conflict — append local_delta beat so the user can continue.",
    },
    {
      id: "local-lom-halt-recursion",
      scope: "local",
      bug_index_instance: USER_SENTINEL,
      pillar: "DEFEND",
      label: "Halt LOM retry loop (session)",
      fix: "Recursion Halt",
      consequence: "Stops emergency LOM re-entry for this session",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: ties to LOM recursion guard — session-only halt after Sentinel triage.",
    },
  ],
  [HITL]: [
    {
      id: "global-converge-consensus",
      scope: "global",
      bug_index_instance: HITL,
      pillar: "CONVERGE",
      label: "Force Consensus (P2 Roadmap)",
      fix: "Force Consensus",
      consequence: "Model Bias increase",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale:
        "Global: collapse dual-model disagreement under MSGF 1.0; Roadmap supersedes stale Vault patterns.",
    },
    {
      id: "global-crossref-roadmap",
      scope: "global",
      bug_index_instance: HITL,
      pillar: "CROSS-REF",
      label: "Prioritize P2 Roadmap over Vault",
      fix: "Roadmap Precedence Override",
      consequence: "Deprioritized historical Vault fixes",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale:
        "Global: strategic cross-ref — register human-corrected logic in global mitigations for future Pulses.",
    },
    {
      id: "local-arbitrate-tiebreak",
      scope: "local",
      bug_index_instance: HITL,
      pillar: "ARBITRATE",
      label: "Session tie-break only",
      fix: "Operator Tie-Break (session)",
      consequence: "No global rule change",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: clears this ARBITRATE queue entry without updating msgf_rules.",
    },
    {
      id: "local-shard-telemetry",
      scope: "local",
      bug_index_instance: HITL,
      pillar: "SHARD",
      label: "Re-shard keystroke telemetry",
      fix: "Telemetry Re-Shard",
      consequence: "Minor rhythm re-capture",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: routine formatting / rhythm slice repair for the current session only.",
    },
  ],
  [LOM_REC]: [
    {
      id: "global-persist-truncate",
      scope: "global",
      bug_index_instance: LOM_REC,
      pillar: "PERSIST",
      label: "Delta Truncation (global)",
      fix: "Delta Truncation",
      consequence: "Minor narrative loss",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale: "Global: strategic persist path when LOM recursion ceiling is hit — favors forward motion.",
    },
    {
      id: "local-defend-halt",
      scope: "local",
      bug_index_instance: LOM_REC,
      pillar: "DEFEND",
      label: "Halt recursion (session)",
      fix: "Recursion Halt",
      consequence: "Pipeline paused until review",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: stop LOM retry loop for this session without changing global persist policy.",
    },
    {
      id: "local-sweep-format",
      scope: "local",
      bug_index_instance: LOM_REC,
      pillar: "SWEEP",
      label: "Normalize input formatting",
      fix: "Input Normalization",
      consequence: "Cosmetic text cleanup only",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: routine SWEEP / formatting hygiene before re-entering CONVERGE.",
    },
  ],
  [SHADOW]: [
    {
      id: "global-defend-override",
      scope: "global",
      bug_index_instance: SHADOW,
      pillar: "DEFEND",
      label: "Shadow Gate Override",
      fix: "Shadow Gate Override",
      consequence: "Hall lineage exposure",
      risk: "High",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale: "Global: strategic DEFEND — operator attestation that Roadmap (MSGF 1.0) overrides shadow match.",
    },
    {
      id: "local-crossref-deprecate",
      scope: "local",
      bug_index_instance: SHADOW,
      pillar: "CROSS-REF",
      label: "Flag stale Vault pattern (session)",
      fix: "Session Vault Deprecation",
      consequence: "Single-session cross-ref only",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: mark conflicting Vault snippet inactive for this pulse only.",
    },
  ],
  [CONSENSUS_FAIL]: [
    {
      id: "global-converge-force",
      scope: "global",
      bug_index_instance: CONSENSUS_FAIL,
      pillar: "CONVERGE",
      label: "Force Consensus",
      fix: "Force Consensus",
      consequence: "Model Bias increase",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale: "Global: strategic CONVERGE failure — human-approved consensus path for similar incidents.",
    },
    {
      id: "local-shard-recapture",
      scope: "local",
      bug_index_instance: CONSENSUS_FAIL,
      pillar: "SHARD",
      label: "Re-capture keystroke shard",
      fix: "Shard Recapture",
      consequence: "Additional telemetry pass",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: telemetry/formatting fix before retrying CONVERGE.",
    },
  ],
  [LOM_DISAGREE]: [
    {
      id: "global-single-model",
      scope: "global",
      bug_index_instance: LOM_DISAGREE,
      pillar: "CONVERGE",
      label: "Single-Model Verdict",
      fix: "Single-Model Verdict",
      consequence: "Reduced dual-model assurance",
      risk: "Medium",
      consequence_score: 0,
      apply_to_future_sessions: true,
      rationale: "Global: strategic simplification when models disagree — register preferred model path.",
    },
    {
      id: "local-arbitrate-minimal",
      scope: "local",
      bug_index_instance: LOM_DISAGREE,
      pillar: "ARBITRATE",
      label: "Minimal session override",
      fix: "Minimal Human Verdict",
      consequence: "Session-only resolution",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: smallest ARBITRATE delta for this incident only.",
    },
  ],
  [VAULT_OK]: [
    {
      id: "global-persist-vault",
      scope: "global",
      bug_index_instance: VAULT_OK,
      pillar: "PERSIST",
      label: "Vault Persist",
      fix: "Vault Persist",
      consequence: "Minimal operational friction",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Global-capable persist path; typically no conflict when consensus already succeeded.",
    },
    {
      id: "local-shard-validate",
      scope: "local",
      bug_index_instance: VAULT_OK,
      pillar: "SHARD",
      label: "Validate rhythm shard",
      fix: "Rhythm Validation",
      consequence: "Routine verification",
      risk: "Low",
      consequence_score: 0,
      apply_to_future_sessions: false,
      rationale: "Local: confirm telemetry shard integrity before persist.",
    },
  ],
};

const RISK_SCORE_ANCHOR: Record<RemediationRisk, number> = {
  Low: 32,
  Medium: 55,
  High: 78,
};

const HIGH_RISK_ACTION_TERMS = [
  "force",
  "override",
  "reject",
  "purge",
  "rollback",
] as const;

const LOW_RISK_ACTION_TERMS = ["truncat", "minimal", "simplify", "halt", "abridge"] as const;

function normalizePillar(pillar: string): P2FlowStep | null {
  const key = pillar.trim().toUpperCase().replace(/\s+/g, "-") as P2FlowStep;
  return (P2_FLOW_SEQUENCE_STEPS as readonly string[]).includes(key) ? key : null;
}

function calculateConsequenceScoreImpl(pillar: string, action: string): number {
  const step = normalizePillar(pillar);
  const actionLower = action.trim().toLowerCase();

  const stepIndex =
    step != null ? P2_FLOW_SEQUENCE_STEPS.indexOf(step) : Math.floor(P2_FLOW_SEQUENCE_STEPS.length / 2);

  const pipelineRatio =
    P2_FLOW_SEQUENCE_STEPS.length > 1
      ? stepIndex / (P2_FLOW_SEQUENCE_STEPS.length - 1)
      : 0.5;

  let score = 28 + pipelineRatio * 42;

  if (step === "DEFEND" || step === "ARBITRATE") {
    score += 8;
  }
  if (step === "CONVERGE" && HIGH_RISK_ACTION_TERMS.some((t) => actionLower.includes(t))) {
    score += 14;
  }
  if (step === "PERSIST" && LOW_RISK_ACTION_TERMS.some((t) => actionLower.includes(t))) {
    score -= 12;
  }

  for (const term of HIGH_RISK_ACTION_TERMS) {
    if (actionLower.includes(term)) score += 6;
  }
  for (const term of LOW_RISK_ACTION_TERMS) {
    if (actionLower.includes(term)) score -= 5;
  }

  if (step && actionLower.includes(step.toLowerCase())) {
    score -= 4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFromMatrixRiskImpl(risk: RemediationRisk, pillar: string, action: string): number {
  const anchor = RISK_SCORE_ANCHOR[risk];
  const computed = calculateConsequenceScoreImpl(pillar, action);
  return Math.round(anchor * 0.45 + computed * 0.55);
}

function scoreRow(row: Omit<ModularRemediationStrategy, "consequence_score">): number {
  const base = scoreFromMatrixRiskImpl(row.risk, row.pillar, row.fix);
  const scopeBoost = row.scope === "global" ? 6 : 0;
  return Math.max(0, Math.min(100, base + scopeBoost));
}

function hydrateMatrix(): Record<string, readonly ModularRemediationStrategy[]> {
  const out: Record<string, readonly ModularRemediationStrategy[]> = {};

  for (const [instance, rows] of Object.entries(MODULAR_STRATEGY_MATRIX)) {
    out[instance] = rows.map((row) => ({
      ...row,
      consequence_score: scoreRow(row),
    }));
  }

  return out;
}

/** Fully scored matrix (consequence_score populated). */
export const SCORED_MODULAR_STRATEGY_MATRIX: Record<string, readonly ModularRemediationStrategy[]> =
  hydrateMatrix();

/**
 * Primary (global-first) row per instance — backward compatible with legacy `REMEDIATION_MATRIX`.
 */
export const REMEDIATION_MATRIX: Record<string, RemediationMatrixRow> = Object.fromEntries(
  Object.entries(SCORED_MODULAR_STRATEGY_MATRIX).map(([instance, strategies]) => {
    const primary =
      strategies.find((s) => s.scope === "global") ?? strategies[0];
    if (!primary) return [instance, null];
    return [
      instance,
      {
        bug_index_instance: primary.bug_index_instance,
        pillar: primary.pillar,
        fix: primary.fix,
        consequence: primary.consequence,
        risk: primary.risk,
      },
    ];
  }).filter((entry): entry is [string, RemediationMatrixRow] => entry[1] != null)
);

/**
 * Accepts a full `1.1.1_*` slug, branch name, or partial key; resolves to matrix key.
 */
export function normalizeBugIndexInstance(bugIndex: string): string | null {
  const raw = bugIndex.trim();
  if (!raw) return null;

  if (SCORED_MODULAR_STRATEGY_MATRIX[raw]) return raw;

  const withPrefix = raw.startsWith("1.1.1_") ? raw : `1.1.1_${raw.replace(/^1\.1\.1_/, "")}`;

  if (SCORED_MODULAR_STRATEGY_MATRIX[withPrefix]) return withPrefix;

  const suffix = withPrefix.replace(/^1\.1\.1_/, "").toUpperCase();
  const match = Object.keys(SCORED_MODULAR_STRATEGY_MATRIX).find((k) =>
    k.replace(/^1\.1\.1_/, "").toUpperCase().includes(suffix)
  );
  return match ?? null;
}

export class RemediationEngine {
  /**
   * Full modular matrix for a bug index (global + local strategies).
   */
  getModularStrategiesForIncident(bugIndex: string): ModularRemediationStrategy[] {
    const instance = normalizeBugIndexInstance(bugIndex);
    if (!instance) return [];
    return [...(SCORED_MODULAR_STRATEGY_MATRIX[instance] ?? [])];
  }

  getGlobalStrategiesForIncident(bugIndex: string): ModularRemediationStrategy[] {
    return this.getModularStrategiesForIncident(bugIndex).filter((s) => s.scope === "global");
  }

  getLocalStrategiesForIncident(bugIndex: string): ModularRemediationStrategy[] {
    return this.getModularStrategiesForIncident(bugIndex).filter((s) => s.scope === "local");
  }

  /**
   * Returns all remediation strategies for a bug index (global + local).
   */
  getStrategiesForIncident(bugIndex: string): RemediationStrategy[] {
    return this.getModularStrategiesForIncident(bugIndex).map((s) => ({
      bug_index_instance: s.bug_index_instance,
      pillar: s.pillar,
      fix: s.fix,
      consequence: s.consequence,
      risk: s.risk,
      consequence_score: s.consequence_score,
      scope: s.scope,
      strategy_id: s.id,
      apply_to_future_sessions: s.apply_to_future_sessions,
      rationale: s.rationale,
    }));
  }

  /**
   * Primary global strategy for an instance (legacy single-row consumers).
   */
  getPrimaryStrategyForIncident(bugIndex: string): RemediationStrategy | null {
    const global = this.getGlobalStrategiesForIncident(bugIndex);
    const pick = global[0] ?? this.getModularStrategiesForIncident(bugIndex)[0];
    if (!pick) return null;
    return {
      bug_index_instance: pick.bug_index_instance,
      pillar: pick.pillar,
      fix: pick.fix,
      consequence: pick.consequence,
      risk: pick.risk,
      consequence_score: pick.consequence_score,
      scope: pick.scope,
      strategy_id: pick.id,
      apply_to_future_sessions: pick.apply_to_future_sessions,
      rationale: pick.rationale,
    };
  }

  /**
   * Numerical risk (0–100) from P2 roadmap position + fix action semantics.
   * Higher = greater risk to Brain stability / Vault integrity.
   */
  calculateConsequenceScore(pillar: string, action: string): number {
    return calculateConsequenceScoreImpl(pillar, action);
  }

  /** Map qualitative matrix risk to a baseline score, blended with P2 calculation. */
  scoreFromMatrixRisk(risk: RemediationRisk, pillar: string, action: string): number {
    return scoreFromMatrixRiskImpl(risk, pillar, action);
  }

  getMatrixRow(bugIndexInstance: string): RemediationMatrixRow | null {
    const key = normalizeBugIndexInstance(bugIndexInstance);
    return key ? (REMEDIATION_MATRIX[key] ?? null) : null;
  }

  /** List all known `1.1.1` instances in the matrix. */
  listMatrixInstances(): string[] {
    return Object.keys(SCORED_MODULAR_STRATEGY_MATRIX);
  }
}

/** Process-wide singleton for admin routes and {@link MsgfBridge} consumers. */
export const remediationEngine = new RemediationEngine();
