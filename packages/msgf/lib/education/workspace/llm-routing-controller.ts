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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
/**
 * Layer B LLM routing controller — independent of Layer A toolbox rendering.
 */
import {
  normalizeAiAllowanceLevel,
  resolveLayerBFlags,
  resolveWorkspaceConfig,
  type AiAllowanceLevel,
  type LayerBRuntimeFlags,
  type ResolvedWorkspaceConfig,
} from "@elphie-syntax/core";

import {
  assertAiAllowanceForLlmOrchestration,
  EducationPolicyHaltError,
} from "@/lib/education/p1-static-ledger";
import { buildLayerBSystemPromptWrapper } from "@/lib/education/workspace/layer-b-prompts";

export type LlmRoutingDecision = {
  allowed: boolean;
  bypassOrchestration: boolean;
  chatInterfaceEnabled: boolean;
  rejectChatStreams: boolean;
  wrapPrompts: boolean;
  heavyAuditLogging: boolean;
  aiAllowanceLevel: AiAllowanceLevel;
  layerB: LayerBRuntimeFlags;
  haltCode?: string;
  haltMessage?: string;
};

export type LlmRoutingInput = {
  gradeCohort: string;
  aiAllowanceLevel: unknown;
  userPrompt: string;
};

export function evaluateLlmRouting(
  input: Pick<LlmRoutingInput, "gradeCohort" | "aiAllowanceLevel">
): LlmRoutingDecision {
  const workspace = resolveWorkspaceConfig({
    gradeCohort: input.gradeCohort,
    aiAllowanceLevel: input.aiAllowanceLevel,
  });
  const { layerB } = workspace;

  try {
    assertAiAllowanceForLlmOrchestration(layerB.aiAllowanceLevel);
    return {
      allowed: true,
      bypassOrchestration: false,
      chatInterfaceEnabled: layerB.chatInterfaceEnabled,
      rejectChatStreams: layerB.rejectChatStreams,
      wrapPrompts: layerB.wrapLlmPrompts,
      heavyAuditLogging: layerB.heavyAuditLogging,
      aiAllowanceLevel: layerB.aiAllowanceLevel,
      layerB,
    };
  } catch (e) {
    if (e instanceof EducationPolicyHaltError) {
      return {
        allowed: false,
        bypassOrchestration: layerB.bypassLlmOrchestration,
        chatInterfaceEnabled: layerB.chatInterfaceEnabled,
        rejectChatStreams: layerB.rejectChatStreams,
        wrapPrompts: false,
        heavyAuditLogging: false,
        aiAllowanceLevel: layerB.aiAllowanceLevel,
        layerB,
        haltCode: e.code,
        haltMessage: e.message,
      };
    }
    throw e;
  }
}

/**
 * Route an LLM request: levels 0–1 halt; 2–4 wrap prompt chains.
 */
export function routeLlmPromptChain(input: LlmRoutingInput): {
  decision: LlmRoutingDecision;
  prompt: string;
  workspace: ResolvedWorkspaceConfig;
} {
  const workspace = resolveWorkspaceConfig({
    gradeCohort: input.gradeCohort,
    aiAllowanceLevel: input.aiAllowanceLevel,
  });
  const decision = evaluateLlmRouting(input);

  if (!decision.allowed) {
    return { decision, prompt: "", workspace };
  }

  const level = normalizeAiAllowanceLevel(input.aiAllowanceLevel);
  const prompt =
    level >= 2
      ? buildLayerBSystemPromptWrapper(level, input.userPrompt)
      : input.userPrompt;

  return { decision, prompt, workspace };
}

export const llmRoutingController = {
  evaluate: evaluateLlmRouting,
  routePrompt: routeLlmPromptChain,
} as const;
