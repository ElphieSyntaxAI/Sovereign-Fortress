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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
import type {
  AdminRemediationStrategy,
  GenealogicalBugIndex,
  HitlIncidentStrategy,
} from "@/lib/admin-browser-api";

export type { GenealogicalBugIndex };

export type P2Pillar =
  | "SWEEP"
  | "SHARD"
  | "DEFEND"
  | "CROSS-REF"
  | "CONVERGE"
  | "ARBITRATE"
  | "PERSIST";

export const P2_PIPELINE: readonly P2Pillar[] = [
  "SWEEP",
  "SHARD",
  "DEFEND",
  "CROSS-REF",
  "CONVERGE",
  "ARBITRATE",
  "PERSIST",
];

export type RiskLevel = "Low" | "Medium" | "High";

export type ConsequenceProfile = {
  integrityRisk: RiskLevel;
  userFriction: RiskLevel;
  vaultDrift: RiskLevel;
  compositeScore: number;
};

export type EnrichedRemediationStrategy = HitlIncidentStrategy & {
  fix_template: string;
  consequences: ConsequenceProfile;
};

const BRANCH_TO_HALT_PILLAR: Record<string, P2Pillar> = {
  "1.1_DEFEND": "DEFEND",
  "1.1_CONVERGE": "CONVERGE",
  "1.1_ARBITRATE": "ARBITRATE",
};

const INSTANCE_HALT_PILLAR: Record<string, P2Pillar> = {
  "1.1.1_HITL_TIEBREAKER": "ARBITRATE",
  "1.1.1_LOM_RECURSION_LIMIT": "DEFEND",
  "1.1.1_SHADOW_REJECT": "DEFEND",
  "1.1.1_CONSENSUS_REJECT": "CONVERGE",
  "1.1.1_LOM_MODEL_DISAGREE": "CONVERGE",
  "1.1.1_CONSENSUS_VAULT": "PERSIST",
};

const FIX_TEMPLATE_BY_STEP: Record<P2Pillar, string> = {
  SWEEP: "Telemetry slice validated; resume rhythm capture under P2.",
  SHARD: "Keystroke shard accepted; continue modular pipeline without scope expansion.",
  DEFEND: "Shadow gate overridden with operator attestation; no deprecated architecture.",
  "CROSS-REF": "Vault lineage cross-ref acknowledged; Roadmap (MSGF 1.0) takes precedence.",
  CONVERGE: "Author intent is valid despite model disagreement.",
  ARBITRATE: "Human tie-breaker clears HITL; minimal Vault delta only.",
  PERSIST: "Approved delta may persist to Vault under genealogical index.",
};

const BUG_INDEX_SYNTHETIC: Record<
  string,
  { pillar: P2Pillar; title: string; templateSeed: string; p2Step: P2Pillar }[]
> = {
  "1.1.1_HITL_TIEBREAKER": [
    {
      pillar: "CONVERGE",
      p2Step: "CONVERGE",
      title: "Affirm author intent (CONVERGE)",
      templateSeed: FIX_TEMPLATE_BY_STEP.CONVERGE,
    },
    {
      pillar: "ARBITRATE",
      p2Step: "ARBITRATE",
      title: "Operator tie-break (ARBITRATE)",
      templateSeed: FIX_TEMPLATE_BY_STEP.ARBITRATE,
    },
    {
      pillar: "PERSIST",
      p2Step: "PERSIST",
      title: "Vault persist path (PERSIST)",
      templateSeed: FIX_TEMPLATE_BY_STEP.PERSIST,
    },
  ],
  "1.1.1_LOM_RECURSION_LIMIT": [
    {
      pillar: "DEFEND",
      p2Step: "DEFEND",
      title: "Halt recursion (DEFEND)",
      templateSeed: FIX_TEMPLATE_BY_STEP.DEFEND,
    },
    {
      pillar: "CONVERGE",
      p2Step: "CONVERGE",
      title: "Simplified converge (CONVERGE)",
      templateSeed: "Collapse dual-model loop; single conservative human verdict only.",
    },
    {
      pillar: "ARBITRATE",
      p2Step: "ARBITRATE",
      title: "Force human gate (ARBITRATE)",
      templateSeed: FIX_TEMPLATE_BY_STEP.ARBITRATE,
    },
  ],
};

function riskFromScore(score: number, invert = false): RiskLevel {
  const v = invert ? 100 - score : score;
  if (v >= 70) return "Low";
  if (v >= 45) return "Medium";
  return "High";
}

export function resolveHaltPillar(bugIndex: GenealogicalBugIndex): P2Pillar {
  return (
    INSTANCE_HALT_PILLAR[bugIndex.level_1_1_1_instance] ??
    BRANCH_TO_HALT_PILLAR[bugIndex.level_1_1_branch] ??
    "ARBITRATE"
  );
}

export function haltPillarLabel(bugIndex: GenealogicalBugIndex): string {
  const pillar = resolveHaltPillar(bugIndex);
  const instance = bugIndex.level_1_1_1_instance.replace(/^1\.1\.1_/, "").replace(/_/g, " ");
  return `${pillar} · ${instance}`;
}

export function buildFixTemplate(
  p2Step: P2Pillar,
  templateSeed: string,
  detail?: string
): string {
  const seed = templateSeed.trim() || FIX_TEMPLATE_BY_STEP[p2Step];
  const body = detail?.trim() ? ` ${detail.trim()}` : "";
  return `[OVERRIDE: ${p2Step}] - ${seed}${body ? `. ${body}` : ""}`;
}

export function deriveConsequenceProfile(strategy: HitlIncidentStrategy): ConsequenceProfile {
  const f = strategy.consequence_factors;
  const integrityScore = 100 - f.risk_penalty * 3;
  const frictionScore =
    strategy.p2_step === "PERSIST" || strategy.p2_step === "ARBITRATE"
      ? 75
      : strategy.p2_step === "CONVERGE"
        ? 55
        : strategy.p2_step === "DEFEND"
          ? 35
          : 50;
  const driftScore = f.roadmap_alignment * 2.5 + f.modular_compliance * 2;

  return {
    integrityRisk: riskFromScore(integrityScore),
    userFriction: riskFromScore(frictionScore, true),
    vaultDrift: riskFromScore(driftScore),
    compositeScore: strategy.consequence_score,
  };
}

export function enrichRemediationStrategy(
  strategy: HitlIncidentStrategy,
  _bugIndex: GenealogicalBugIndex
): EnrichedRemediationStrategy {
  const p2Step = strategy.p2_step as P2Pillar;
  return {
    ...strategy,
    fix_template: buildFixTemplate(
      p2Step,
      FIX_TEMPLATE_BY_STEP[p2Step] ?? FIX_TEMPLATE_BY_STEP.ARBITRATE,
      strategy.fix_summary
    ),
    consequences: deriveConsequenceProfile(strategy),
  };
}

function synthesizeFromBugIndex(bugIndex: GenealogicalBugIndex): EnrichedRemediationStrategy[] {
  const presets =
    BUG_INDEX_SYNTHETIC[bugIndex.level_1_1_1_instance] ??
    BUG_INDEX_SYNTHETIC["1.1.1_HITL_TIEBREAKER"];

  const ids: HitlIncidentStrategy["id"][] = ["A", "B", "C"];
  const scores = [72, 58, 44];

  return presets.map((preset, i) => {
    const id = ids[i];
    const consequence_score = scores[i];
    const risk_penalty = 30 - i * 8;
    const base: HitlIncidentStrategy = {
      id,
      title: preset.title,
      fix_summary: preset.templateSeed,
      p2_step: preset.p2Step,
      consequence_score,
      consequence_factors: {
        roadmap_alignment: 28 - i * 4,
        modular_compliance: 22 - i * 3,
        risk_penalty,
        ai_assessment: 20 - i * 4,
      },
      rationale: `Synthetic remediation for ${bugIndex.level_1_1_1_instance} (halt pillar ${preset.pillar}).`,
    };
    return {
      ...base,
      fix_template: buildFixTemplate(preset.p2Step, preset.templateSeed),
      consequences: deriveConsequenceProfile(base),
    };
  });
}

export function remediationStrategiesForBugIndex(
  bugIndex: GenealogicalBugIndex,
  apiStrategies: HitlIncidentStrategy[] | undefined
): EnrichedRemediationStrategy[] {
  if (apiStrategies?.length) {
    return apiStrategies.map((s) => enrichRemediationStrategy(s, bugIndex));
  }
  return synthesizeFromBugIndex(bugIndex);
}

/** Map client-side enriched strategies to admin matrix DTO (API fetch fallback). */
export function enrichedToAdminRemediationStrategy(
  strategy: EnrichedRemediationStrategy
): AdminRemediationStrategy {
  const driftPenalty =
    strategy.consequences.vaultDrift === "High"
      ? 18
      : strategy.consequences.vaultDrift === "Medium"
        ? 8
        : 0;
  const riskScore = Math.max(
    0,
    Math.min(100, Math.round(100 - strategy.consequence_score + driftPenalty))
  );

  return {
    pillar: strategy.p2_step,
    label: strategy.title,
    fixTemplate: strategy.fix_template,
    consequence: strategy.fix_summary,
    riskScore,
  };
}

export type BrainStabilityTier = "green" | "yellow" | "red";

/** Brain stability badge tier from composite consequence score. */
export function brainStabilityTier(strategy: HitlIncidentStrategy): BrainStabilityTier {
  const { consequence_score, consequence_factors } = strategy;
  const penalty = consequence_factors.risk_penalty;

  if (consequence_score >= 75 && penalty < 15) return "green";
  if (consequence_score >= 50 && penalty < 22) return "yellow";
  return "red";
}
