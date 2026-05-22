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
 * Distribution Build ID: MSGF-44d0906-20260522T043912Z-internal
 */
/**
 * Pre-generates three HITL fix strategies grounded in P2 Roadmap (MSGF 1.0 flow sequence).
 */

import { getVertexGenerativeModelForId } from "@/lib/msgf-vertex";
import {
  AiHitlStrategiesResponseSchema,
  HitlIncidentStrategiesSchema,
  type HitlIncidentStrategies,
} from "@/lib/schemas/hitl-strategies";
import {
  isCostRunawayError,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";
import {
  buildP2RoadmapDirective,
  DEFAULT_P2_ROADMAP,
  type P2FlowStep,
  type P2RoadmapConfig,
  type PrioritizedVaultLineage,
} from "@/lib/services/p2-flow-roadmap";
import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import type { ModelVerdict } from "@/lib/msgf-consensus";

export type HitlStrategyGenerationContext = {
  geminiModelId: string;
  pulseText: string;
  reason: string;
  halScore: number;
  retryCount: number;
  geminiVerdict: ModelVerdict;
  claudeVerdict: ModelVerdict;
  modelsDisagree: boolean;
  haltStateSummary?: string;
  persistableDelta?: string;
  p2Roadmap?: P2RoadmapConfig;
  p2FlowDirective?: string;
  vaultCrossRefContext?: string;
  vaultP2Prioritized?: PrioritizedVaultLineage;
};

function strategiesDisabled(): boolean {
  const v = process.env.MSGF_HITL_STRATEGIES_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function roadmapAlignmentScore(fixText: string, roadmap: P2RoadmapConfig): number {
  const haystack = fixText.toLowerCase();
  let hits = 0;
  for (const step of roadmap.steps) {
    if (haystack.includes(step.toLowerCase())) hits += 1;
  }
  for (const kw of roadmap.alignmentKeywords) {
    if (haystack.includes(kw.toLowerCase())) hits += 0.25;
  }
  return Math.min(40, Math.round(hits * 8));
}

function modularComplianceScore(fixText: string, p2Step: P2FlowStep): number {
  const haystack = fixText.toLowerCase();
  const anchors = [
    p2Step.toLowerCase(),
    "modular",
    "pulseengine",
    "vault",
    "hall",
    "constraint",
    "persist",
    "converge",
    "arbitrate",
  ];
  let hits = 0;
  for (const a of anchors) {
    if (haystack.includes(a)) hits += 1;
  }
  return Math.min(30, hits * 5);
}

function riskPenaltyScore(
  fixText: string,
  roadmap: P2RoadmapConfig,
  retryCount: number
): number {
  const haystack = fixText.toLowerCase();
  let penalty = 0;
  for (const kw of roadmap.deprecatedKeywords) {
    if (haystack.includes(kw.toLowerCase())) penalty += 8;
  }
  if (/\b(revert|rollback|monolith|legacy express)\b/i.test(fixText)) penalty += 10;
  if (retryCount >= 3 && /\b(expand|refactor entire|rewrite)\b/i.test(fixText)) penalty += 6;
  return Math.min(30, penalty);
}

function computeConsequenceScore(input: {
  fixSummary: string;
  p2Step: P2FlowStep;
  aiRiskAssessment: number;
  roadmap: P2RoadmapConfig;
  retryCount: number;
  vaultContradictionCount: number;
}) {
  const roadmap_alignment = roadmapAlignmentScore(input.fixSummary, input.roadmap);
  const modular_compliance = modularComplianceScore(input.fixSummary, input.p2Step);
  const risk_penalty =
    riskPenaltyScore(input.fixSummary, input.roadmap, input.retryCount) +
    Math.min(10, input.vaultContradictionCount * 3);
  const ai_assessment = Math.round(Math.min(30, Math.max(0, input.aiRiskAssessment) * 0.3));

  const raw =
    roadmap_alignment + modular_compliance + ai_assessment - risk_penalty;
  const consequence_score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    consequence_score,
    consequence_factors: {
      roadmap_alignment,
      modular_compliance,
      risk_penalty,
      ai_assessment,
    },
  };
}

/**
 * Generates three ranked fix strategies for `1.1.1_HITL_TIEBREAKER` incidents.
 */
export async function generateHitlStrategies(
  ctx: HitlStrategyGenerationContext
): Promise<HitlIncidentStrategies | null> {
  if (strategiesDisabled()) return null;

  const roadmap = ctx.p2Roadmap ?? DEFAULT_P2_ROADMAP;
  const vaultContradictionCount = ctx.vaultP2Prioritized?.contradicts.length ?? 0;

  const model = getVertexGenerativeModelForId(ctx.geminiModelId);
  const prompt = `You are the MSGF ARBITRATE strategist. The Pulse pipeline halted at HITL tie-breaker.
Propose exactly THREE distinct fix strategies an operator can approve. Each must align with the P2 Roadmap (MSGF 1.0).

${buildP2RoadmapDirective(roadmap)}
${ctx.p2FlowDirective ?? ""}
${ctx.vaultCrossRefContext ?? ""}

Rules:
- Privacy: do NOT quote raw user keystrokes; infer intent only.
- Each strategy must map to one canonical P2 step: ${roadmap.steps.join(", ")}.
- Strategies must differ materially (conservative / balanced / roadmap-forward).
- fix_summary: 2–4 sentences, engineering-safe, minimal scope.
- ai_risk_assessment: 0–100 where HIGHER means safer / lower downstream Hall risk.
- No markdown fences in JSON.

Context:
- halt_reason: ${ctx.reason}
- hal_score: ${ctx.halScore}
- retry_count: ${ctx.retryCount}
- gemini_verdict: ${ctx.geminiVerdict}
- claude_verdict: ${ctx.claudeVerdict}
- models_disagree: ${ctx.modelsDisagree}
${ctx.haltStateSummary ? `- halt_state_summary:\n${ctx.haltStateSummary.slice(0, 1200)}` : ""}
${ctx.persistableDelta ? `- engine_delta:\n${ctx.persistableDelta.slice(0, 800)}` : ""}

Return ONLY JSON:
{
  "strategies": [
    { "id": "A", "title": "...", "fix_summary": "...", "p2_step": "ARBITRATE", "ai_risk_assessment": 82, "rationale": "..." },
    { "id": "B", "title": "...", "fix_summary": "...", "p2_step": "PERSIST", "ai_risk_assessment": 70, "rationale": "..." },
    { "id": "C", "title": "...", "fix_summary": "...", "p2_step": "CONVERGE", "ai_risk_assessment": 55, "rationale": "..." }
  ]
}`;

  try {
    const result = await runWithLlmTimeoutSimple("hitl.strategy.generator", () =>
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1400,
          responseMimeType: "application/json",
        },
      })
    );

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;

    const parsed = AiHitlStrategiesResponseSchema.parse(extractJsonObject(text));

    const strategies = parsed.strategies.map((draft) => {
      const scored = computeConsequenceScore({
        fixSummary: draft.fix_summary,
        p2Step: draft.p2_step,
        aiRiskAssessment: draft.ai_risk_assessment,
        roadmap,
        retryCount: ctx.retryCount,
        vaultContradictionCount,
      });

      return {
        id: draft.id,
        title: draft.title.trim(),
        fix_summary: draft.fix_summary.trim(),
        p2_step: draft.p2_step,
        rationale: draft.rationale.trim(),
        ...scored,
      };
    });

    strategies.sort((a, b) => b.consequence_score - a.consequence_score);

    const bundle = HitlIncidentStrategiesSchema.parse({
      generated_at: new Date().toISOString(),
      roadmap_version: roadmap.version,
      p2_pipeline: [...roadmap.steps],
      strategies,
    });

    return bundle;
  } catch (e) {
    if (isCostRunawayError(e)) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hitl-strategy-generator]", msg);
    return null;
  }
}

export function isHitlTiebreakerBugIndex(bugIndex: {
  level_1_1_1_instance: string;
}): boolean {
  return bugIndex.level_1_1_1_instance === PULSE_BUG_INDEX.hallHitlRequired.level_1_1_1_instance;
}
